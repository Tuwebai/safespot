import { useState, useCallback, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ALL_CATEGORIES } from '@/lib/constants'
import { LocationData } from '@/components/LocationSelector'
import { useToast } from '@/components/ui/toast'
import { useCreateReportMutation } from '@/hooks/mutations/useCreateReportMutation'
import { reportsApi } from '@/lib/api'
import { handleErrorSilently } from '@/lib/errorHandler'
import { useNavigate } from 'react-router-dom'
import { compressImage, formatFileSize } from '@/lib/imageCompression'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'

// ============================================
// SCHEMAS POR PASO
// ============================================

export const step1Schema = z.object({
    title: z.string().min(5, 'El título debe tener al menos 5 caracteres').max(200, 'Máximo 200 caracteres'),
    category: z.enum([...ALL_CATEGORIES] as [string, ...string[]], {
        message: 'Selecciona una categoría'
    }),
})

export const step2Schema = z.object({
    description: z.string().min(20, 'Mínimo 20 caracteres').max(2000, 'Máximo 2000 caracteres'),
})

export const step3Schema = z.object({
    location: z.object({
        location_name: z.string().min(3, 'Ingresa una ubicación válida').max(255),
        // 🔒 TYPE FIX: Made lat/lng optional to allow progressive validation in wizard
        // These are validated at submission time, not during step navigation
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        zone: z.string().optional()
    }),
    incidentDate: z.string().min(1, 'Selecciona una fecha'),
})

export type Step1Data = z.infer<typeof step1Schema>
export type Step2Data = z.infer<typeof step2Schema>
export type Step3Data = z.infer<typeof step3Schema>

export interface WizardFormData extends Step1Data, Step2Data, Step3Data {}

// ============================================
// HOOK
// ============================================

const DRAFT_KEY = 'safespot_wizard_draft'
const STEP_KEY = 'safespot_wizard_step'
const SESSION_KEY = 'safespot_wizard_session'

// Función para verificar/limpiar sesión antes de inicializar estado
function checkAndCleanSession(): { isNewSession: boolean; sessionId: string } {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const savedSession = localStorage.getItem(SESSION_KEY)
    
    // Si no hay sesión guardada o es diferente, es nueva sesión
    const isNewSession = !savedSession || savedSession !== sessionId
    
    if (isNewSession) {
        // Limpiar datos residuales de sesión anterior completada
        localStorage.removeItem(DRAFT_KEY)
        localStorage.removeItem(STEP_KEY)
        localStorage.setItem(SESSION_KEY, sessionId)
    }
    
    return { isNewSession, sessionId }
}

export function useReportWizard() {
    const navigate = useNavigate()
    const toast = useToast()
    const createdUrlsRef = useRef<string[]>([])
    
    // Verificar sesión UNA VEZ al inicio (antes de inicializar form)
    const sessionRef = useRef(checkAndCleanSession())
    const { isNewSession } = sessionRef.current
    
    const [currentStep, setCurrentStep] = useState(() => {
        if (isNewSession) return 1
        const saved = localStorage.getItem(STEP_KEY)
        return saved ? parseInt(saved, 10) : 1
    })
    
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [imagePreviews, setImagePreviews] = useState<string[]>([])
    const [isCompressing, setIsCompressing] = useState(false)
    const [compressionProgress, setCompressionProgress] = useState('')

    // Form principal - defaultValues depende de si es nueva sesión
    const form = useForm<WizardFormData>({
        resolver: zodResolver(z.object({
            ...step1Schema.shape,
            ...step2Schema.shape,
            ...step3Schema.shape,
        })),
        defaultValues: (() => {
            // Si es nueva sesión, SIEMPRE usar valores limpios (no leer localStorage)
            if (isNewSession) {
                return {
                    title: '',
                    category: undefined,
                    description: '',
                    location: {
                        location_name: '',
                        latitude: undefined,
                        longitude: undefined,
                    },
                    incidentDate: new Date().toISOString()
                }
            }
            
            // Si es misma sesión, intentar recuperar borrador
            try {
                const saved = localStorage.getItem(DRAFT_KEY)
                if (saved) {
                    const parsed = JSON.parse(saved)
                    return {
                        ...parsed,
                        incidentDate: parsed.incidentDate || new Date().toISOString()
                    }
                }
            } catch { /* ignore */ }
            
            return {
                title: '',
                category: undefined,
                description: '',
                location: {
                    location_name: '',
                    latitude: undefined,
                    longitude: undefined,
                },
                incidentDate: new Date().toISOString()
            }
        })(),
        mode: 'onBlur'
    })

    const { setValue, watch, getValues, trigger, formState: { errors } } = form
    const formValues = watch()

    // Auto-save draft
    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues))
            localStorage.setItem(STEP_KEY, currentStep.toString())
        }, 500)
        return () => clearTimeout(timer)
    }, [formValues, currentStep])

    // Validar paso actual
    const validateStep = useCallback(async (step: number): Promise<boolean> => {
        let fieldsToValidate: string[] = []
        
        switch (step) {
            case 1:
                fieldsToValidate = ['title', 'category']
                return await trigger(fieldsToValidate as any)
            case 2:
                fieldsToValidate = ['description']
                return await trigger(fieldsToValidate as any)
            case 3:
                fieldsToValidate = ['location', 'incidentDate']
                return await trigger(fieldsToValidate as any)
            default:
                return true
        }
    }, [trigger])

    // Navegación
    const goToStep = useCallback(async (step: number) => {
        if (step > currentStep) {
            const isValid = await validateStep(currentStep)
            if (!isValid) {
                toast.error('Completa todos los campos antes de continuar')
                return
            }
        }
        setCurrentStep(step)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [currentStep, validateStep, toast])

    const nextStep = useCallback(async () => {
        if (currentStep < 4) {
            await goToStep(currentStep + 1)
        }
    }, [currentStep, goToStep])

    const prevStep = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [currentStep])

    // Handlers de campos
    const handleLocationChange = useCallback((location: LocationData) => {
        // 🔒 TYPE SAFETY FIX: Ensure required fields are present before setting value
        // LocationData has optional lat/lng, but form requires them
        if (!location.latitude || !location.longitude) {
            console.warn('[useReportWizard] Location missing coordinates:', location)
            return
        }
        
        // 🔒 TYPE FIX: Build the value to match Step3Data['location'] type
        const locationValue: Step3Data['location'] = {
            location_name: location.location_name,
            latitude: location.latitude,
            longitude: location.longitude,
            zone: undefined // zone is optional in the schema
        }
        
        setValue('location', locationValue, { 
            shouldValidate: true,
            shouldDirty: true 
        })
    }, [setValue])

    const handleDateChange = useCallback((date: string) => {
        setValue('incidentDate', date, { 
            shouldValidate: true,
            shouldDirty: true 
        })
    }, [setValue])

    // Image handlers (reutilizados de useCreateReportForm)
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

            if (file.size > 15 * 1024 * 1024) {
                toast.warning(`${file.name} es demasiado grande (máx 15MB)`)
                continue
            }

            setCompressionProgress(`Optimizando ${i + 1}/${filesToProcess.length}...`)

            try {
                const result = await compressImage(file, (progress) => {
                    setCompressionProgress(`Optimizando ${file.name}: ${Math.round(progress)}%`)
                })

                compressedFiles.push(result.file)
                const url = URL.createObjectURL(result.file)
                createdUrlsRef.current.push(url)
                newPreviews.push(url)

                const savingsPercent = (1 - result.compressionRatio) * 100
                if (savingsPercent > 50) {
                    toast.success(`${file.name}: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (-${savingsPercent.toFixed(0)}%)`)
                }
            } catch (error) {
                handleErrorSilently(error, 'imageCompression')
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
            newPreviews.splice(index, 1)
            return newPreviews
        })
    }, [])

    // Cleanup
    useEffect(() => {
        const urlsToCleanup = createdUrlsRef.current
        return () => {
            urlsToCleanup.forEach(url => {
                try { URL.revokeObjectURL(url) } catch {}
            })
        }
    }, [])

    // Submit - ENTERPRISE: 0ms Optimistic Creation
    const { mutate: createReport } = useCreateReportMutation()

    const submitReport = useCallback(async () => {
        const isValid = await validateStep(3)
        if (!isValid) {
            toast.error('Completa todos los campos requeridos')
            return
        }

        const data = getValues()
        const reportId = crypto.randomUUID()

        const payload = {
            id: reportId,
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

        // ✅ ENTERPRISE: Navegar DESPUÉS de iniciar la mutación (no antes)
        // El optimistic update (onMutate) debe ejecutarse antes de la navegación
        // para que el reporte ya esté en el cache cuando se renderice /reportes
        
        setIsSubmitting(true)
        
        // ✅ LIMPIAR INMEDIATAMENTE - antes de navegar para evitar que persista al volver
        localStorage.removeItem(DRAFT_KEY)
        localStorage.removeItem(STEP_KEY)
        localStorage.removeItem(SESSION_KEY) // Invalidar sesión para que la próxima vez inicie limpio
        
        // Resetear form a valores iniciales (por si el usuario vuelve atrás)
        form.reset({
            title: '',
            category: undefined,
            description: '',
            location: {
                location_name: '',
                latitude: undefined,
                longitude: undefined,
            },
            incidentDate: new Date().toISOString()
        })
        setCurrentStep(1)
        setImageFiles([])
        setImagePreviews([])
        
        createReport(payload, {
            onSuccess: (serverReport) => {
                // Invalidar gamification (badges pueden cambiar)
                queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all })
                
                // Subir imágenes en background
                if (imageFiles.length > 0) {
                    reportsApi.uploadImages(serverReport.id, imageFiles)
                        .then(() => {
                            console.log('[Wizard] Imágenes subidas correctamente')
                        })
                        .catch((error) => {
                            handleErrorSilently(error, 'wizard.uploadImages')
                            toast.warning('Error al subir imágenes, pero el reporte se guardó.')
                        })
                }
                
                toast.success('¡Reporte publicado con éxito!')
                setIsSubmitting(false)
            },
            onError: (error) => {
                handleErrorSilently(error, 'wizard.submit')
                toast.error('Error al crear el reporte. Intentá de nuevo.')
                setIsSubmitting(false)
            }
        })
        
        // ✅ Navegar inmediatamente - el optimistic update ya insertó el reporte
        navigate('/reportes')
        toast.success('¡Creando reporte...!')
        
    }, [getValues, validateStep, createReport, imageFiles, navigate, toast, queryClient, form])

    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_KEY)
        localStorage.removeItem(STEP_KEY)
    }, [])

    return {
        currentStep,
        totalSteps: 4,
        form,
        errors,
        imageFiles,
        imagePreviews,
        isSubmitting,
        isCompressing,
        compressionProgress,
        goToStep,
        nextStep,
        prevStep,
        handleLocationChange,
        handleDateChange,
        handleImageUpload,
        handleRemoveImage,
        submitReport,
        clearDraft,
        getValues,
    }
}
