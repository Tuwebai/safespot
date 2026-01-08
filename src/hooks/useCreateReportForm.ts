import { useState, useCallback, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ALL_CATEGORIES } from '@/lib/constants'
import { LocationData } from '@/components/LocationSelector'
import { useToast } from '@/components/ui/toast'
import { useCreateReportMutation } from '@/hooks/queries/useReportsQuery'
import { reportsApi } from '@/lib/api'
import { handleErrorSilently } from '@/lib/errorHandler'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { useNavigate } from 'react-router-dom'
import { compressImage, formatFileSize } from '@/lib/imageCompression'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'

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
    const { mutateAsync: createReport, isPending: isSubmittingReport, error: submitError } = useCreateReportMutation()

    // Local State
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [imagePreviews, setImagePreviews] = useState<string[]>([])
    const [isCompressing, setIsCompressing] = useState(false)
    const [compressionProgress, setCompressionProgress] = useState<string>('')

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

    // Image Handlers with COMPRESSION
    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        const filesToProcess = Array.from(files).slice(0, 5 - imageFiles.length)
        if (filesToProcess.length === 0) return

        setIsCompressing(true)
        const compressedFiles: File[] = []
        const newPreviews: string[] = []

        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i]

            // Skip files over 15MB (safety limit)
            if (file.size > 15 * 1024 * 1024) {
                toast.warning(`${file.name} es demasiado grande (máx 15MB)`)
                continue
            }

            setCompressionProgress(`Optimizando ${i + 1}/${filesToProcess.length}...`)

            try {
                // Compress image before storing
                const result = await compressImage(file, (progress) => {
                    setCompressionProgress(
                        `Optimizando ${file.name}: ${Math.round(progress)}%`
                    )
                })

                compressedFiles.push(result.file)

                // Create preview from compressed file
                const url = URL.createObjectURL(result.file)
                createdUrlsRef.current.push(url)
                newPreviews.push(url)

                // Show savings toast for large compressions
                const savingsPercent = (1 - result.compressionRatio) * 100
                if (savingsPercent > 50) {
                    toast.success(
                        `${file.name}: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (-${savingsPercent.toFixed(0)}%)`
                    )
                }
            } catch (error) {
                handleErrorSilently(error, 'imageCompression')
                // Fallback: use original
                compressedFiles.push(file)
                const url = URL.createObjectURL(file)
                createdUrlsRef.current.push(url)
                newPreviews.push(url)
            }
        }

        setImageFiles(prev => [...prev, ...compressedFiles].slice(0, 5))
        setImagePreviews(prev => [...prev, ...newPreviews].slice(0, 5))
        setIsCompressing(false)
        setCompressionProgress('')
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
        const urlsToCleanup = createdUrlsRef.current;
        return () => {
            urlsToCleanup.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.error('Revoke failed', e);
                }
            })
        }
    }, [])

    // ============================================
    // SUBMIT LOGIC
    // ============================================

    const onSubmit = handleSubmit(async (data: CreateReportFormData) => {
        if (!data.location.latitude || !data.location.longitude) {
            toast.error('Ubicación inválida: Faltan coordenadas.')
            return
        }

        const payload = {
            title: data.title,
            description: data.description,
            category: data.category,
            zone: data.location.zone || '',
            address: data.location.location_name,
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            status: 'pendiente' as const,
            incident_date: data.incidentDate
        }

        // INSTANT FEEDBACK - Clear form and navigate immediately
        form.reset()
        setImageFiles([])
        setImagePreviews([])
        toast.success('¡Reporte creado!')

        // Navigate INSTANTLY to reports list (optimistic report already visible there)
        navigate('/reportes')

        // Fire mutation WITHOUT awaiting - let optimistic update handle it
        createReport(payload)
            .then((newReport) => {
                // Background: Navigate to detail page after short delay
                // No redirection to detail, stay in list as requested


                // Trigger badge check
                triggerBadgeCheck(newReport.newBadges)
                queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all })

                // Background Image Upload
                if (imageFiles.length > 0) {
                    reportsApi.uploadImages(newReport.id, imageFiles)
                        .then(() => {
                            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
                        })
                        .catch((error) => {
                            handleErrorSilently(error, 'useCreateReportForm.uploadImages.bg')
                            toast.warning('Ocurrió un error al subir las imágenes, pero tu reporte se guardó.')
                        })
                }
            })
            .catch((error) => {
                handleErrorSilently(error, 'useCreateReportForm.submit')
                toast.error('Error al crear el reporte. Intentá de nuevo.')
            })
    })

    return {
        form,
        imageFiles,
        imagePreviews,
        isSubmitting: isSubmittingReport,
        isCompressing,
        compressionProgress,
        submitError,

        // Actions
        handleLocationChange,
        handleDateChange,
        handleImageUpload,
        handleRemoveImage,
        submit: onSubmit
    }
}
