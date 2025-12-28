import { useState, useCallback, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ALL_CATEGORIES } from '@/lib/constants'
import { LocationData } from '@/components/LocationSelector'
import { useToast } from '@/components/ui/toast'
import { useCreateReport } from '@/hooks/useReports'
import { reportsApi } from '@/lib/api'
import { handleErrorSilently } from '@/lib/errorHandler'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { useNavigate } from 'react-router-dom'

// ============================================
// SCHEMA DEFINITION
// ============================================

export const createReportSchema = z.object({
    title: z.string().min(5, 'El título debe tener al menos 5 caracteres').max(200, 'El título no puede exceder 200 caracteres'),
    description: z.string().min(20, 'La descripción debe tener al menos 20 caracteres').max(2000, 'La descripción no puede exceder 2000 caracteres'),
    category: z.enum([...ALL_CATEGORIES] as [string, ...string[]], {
        message: 'Debes seleccionar una categoría válida'
    }),
    location: z.object({
        location_name: z.string()
            .min(3, 'La ubicación debe tener al menos 3 caracteres')
            .max(255, 'La ubicación no puede exceder 255 caracteres')
            .refine(
                (val) => val.toLowerCase().length >= 3,
                { message: 'Ingresá al menos un barrio o ciudad' }
            ),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        // Added for zone tracking
        zone: z.string().optional()
    }),
    incidentDate: z.string().min(1, 'La fecha del incidente es requerida'),
})

export type CreateReportFormData = z.infer<typeof createReportSchema>

// ============================================
// HOOK
// ============================================

export function useCreateReportForm() {
    const createdUrlsRef = useRef<string[]>([])
    const navigate = useNavigate()
    const toast = useToast()
    const { createReport, isLoading: isSubmittingReport, error: submitError } = useCreateReport()

    // Local State
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [imagePreviews, setImagePreviews] = useState<string[]>([])
    const [isUploadingImages, setIsUploadingImages] = useState(false)

    // Form Initialization
    const form = useForm<CreateReportFormData>({
        resolver: zodResolver(createReportSchema),
        defaultValues: {
            location: {
                location_name: '',
                latitude: undefined,
                longitude: undefined,
            },
            incidentDate: new Date().toISOString()
        }
    })

    const { setValue, handleSubmit } = form
    // const currentLocation = watch('location')

    // ============================================
    // HANDLERS
    // ============================================

    const handleLocationChange = useCallback((location: LocationData) => {
        setValue('location', { ...location, zone: undefined }, { shouldValidate: true })
    }, [setValue])

    const handleDateChange = useCallback((date: string) => {
        setValue('incidentDate', date, { shouldValidate: true })
    }, [setValue])

    // Image Handlers (Extracted)
    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        const newFiles: File[] = []
        const newPreviews: string[] = []

        for (let i = 0; i < Math.min(files.length, 5 - imageFiles.length); i++) {
            const file = files[i]
            if (file.size > 10 * 1024 * 1024) {
                toast.warning(`La imagen ${file.name} es demasiado grande. Máximo 10MB.`)
                continue
            }
            newFiles.push(file)
            const url = URL.createObjectURL(file)
            createdUrlsRef.current.push(url)
            newPreviews.push(url)
        }

        setImageFiles(prev => [...prev, ...newFiles].slice(0, 5))
        setImagePreviews(prev => [...prev, ...newPreviews].slice(0, 5))
    }, [imageFiles.length, toast])

    const handleRemoveImage = useCallback((index: number) => {
        setImageFiles(prev => {
            const newFiles = [...prev]
            newFiles.splice(index, 1)
            return newFiles
        })
        setImagePreviews(prev => {
            const newPreviews = [...prev]
            // Cleanup deferred to unmount via ref
            newPreviews.splice(index, 1)
            return newPreviews
        })
    }, [])

    // Clean up previews effect - Runs only on unmount
    useEffect(() => {
        return () => {
            createdUrlsRef.current.forEach(url => {
                try { URL.revokeObjectURL(url) } catch { }
            })
        }
    }, [])

    // ============================================
    // SUBMIT LOGIC
    // ============================================

    const onSubmit = handleSubmit(async (data: CreateReportFormData) => {
        // Final Validation
        if (!data.location.latitude || !data.location.longitude) {
            toast.error('Ubicación inválida: Faltan coordenadas.')
            return
        }

        try {
            const payload = {
                title: data.title,
                description: data.description,
                category: data.category,
                zone: 'Sin zona',
                address: data.location.location_name,
                latitude: data.location.latitude,
                longitude: data.location.longitude,
                status: 'pendiente' as const,
                incident_date: data.incidentDate
            }

            const newReport = await createReport(payload)

            if (imageFiles.length > 0) {
                setIsUploadingImages(true)
                try {
                    await reportsApi.uploadImages(newReport.id, imageFiles)
                } catch (error) {
                    handleErrorSilently(error, 'useCreateReportForm.uploadImages')
                    toast.warning('Reporte creado pero falló la subida de imágenes.')
                } finally {
                    setIsUploadingImages(false)
                }
            }

            triggerBadgeCheck()
            navigate('/reportes')
            toast.success('Reporte creado exitosamente')

        } catch (error) {
            // Handled by hook
        }
    })

    return {
        form,
        imageFiles,
        imagePreviews,
        isSubmitting: isSubmittingReport || isUploadingImages,
        submitError,

        // Actions
        handleLocationChange,
        handleDateChange,
        handleImageUpload,
        handleRemoveImage,
        submit: onSubmit
    }
}
