import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { LocationSelector, type LocationData } from '@/components/LocationSelector'
import { VisualDatePicker } from '@/components/VisualDatePicker'
import { useCreateReport } from '@/hooks/useReports'
import { reportsApi } from '@/lib/api'
import { ALL_CATEGORIES } from '@/lib/constants'
import { AlertCircle, Upload, X } from 'lucide-react'

// Zod schema
const createReportSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres').max(200, 'El título no puede exceder 200 caracteres'),
  description: z.string().min(20, 'La descripción debe tener al menos 20 caracteres').max(2000, 'La descripción no puede exceder 2000 caracteres'),
  category: z.enum([...ALL_CATEGORIES] as [string, ...string[]], {
    message: 'Debes seleccionar una categoría válida'
  }),
  location: z.object({
    location_name: z.string().min(3, 'La dirección debe tener al menos 3 caracteres').max(255, 'La dirección no puede exceder 255 caracteres'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  incidentDate: z.string().min(1, 'La fecha del incidente es requerida'),
})

type CreateReportFormData = z.infer<typeof createReportSchema>

export function CrearReporte() {
  const navigate = useNavigate()
  const { createReport, isLoading, error } = useCreateReport()
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<CreateReportFormData>({
    resolver: zodResolver(createReportSchema),
    defaultValues: {
      location: {
        location_name: '',
        latitude: undefined,
        longitude: undefined
      },
      incidentDate: new Date().toISOString()
    }
  })

  const location = watch('location')
  const incidentDate = watch('incidentDate')

  const handleLocationChange = (location: LocationData) => {
    setValue('location', location, { shouldValidate: true })
  }

  const handleDateChange = (date: string) => {
    setValue('incidentDate', date, { shouldValidate: true })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newFiles: File[] = []
    const newPreviews: string[] = []

    try {
      for (let i = 0; i < Math.min(files.length, 5 - imageFiles.length); i++) {
        const file = files[i]
        if (file.size > 10 * 1024 * 1024) {
          alert(`La imagen ${file.name} es demasiado grande. Máximo 10MB.`)
          continue
        }

        newFiles.push(file)
        // Create preview URL for UI only
        const previewUrl = URL.createObjectURL(file)
        newPreviews.push(previewUrl)
      }

      setImageFiles(prev => [...prev, ...newFiles].slice(0, 5))
      setImagePreviews(prev => [...prev, ...newPreviews].slice(0, 5))
    } catch (error) {
      alert('Error al procesar las imágenes')
    }
  }

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => {
      const newFiles = [...prev]
      newFiles.splice(index, 1)
      return newFiles
    })
    setImagePreviews(prev => {
      const newPreviews = [...prev]
      URL.revokeObjectURL(newPreviews[index])
      newPreviews.splice(index, 1)
      return newPreviews
    })
  }

  const onSubmit = async (data: CreateReportFormData) => {
    try {
      // Map form data to backend payload (without images)
      const payload = {
        title: data.title,
        description: data.description,
        category: data.category,
        zone: 'Centro', // Default zone, can be extracted from location if needed
        address: data.location.location_name,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        status: 'pendiente' as const,
        incident_date: data.incidentDate || new Date().toISOString()
      }

      // Create report first (without images)
      const newReport = await createReport(payload)

      // Upload images if any
      if (imageFiles.length > 0) {
        setIsUploadingImages(true)
        try {
          await reportsApi.uploadImages(newReport.id, imageFiles)
        } catch (imageError) {
          console.error('Error uploading images:', imageError)
          // Report was created successfully, but images failed
          // Navigate anyway - user can add images later
          alert('El reporte se creó correctamente, pero hubo un error al subir las imágenes.')
        } finally {
          setIsUploadingImages(false)
        }
      }

      // Clean up preview URLs
      imagePreviews.forEach(url => URL.revokeObjectURL(url))
    } catch (error) {
      // Error handled by useCreateReport hook
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="gradient-text">Crear Nuevo Reporte</span>
        </h1>
        <p className="text-foreground/70">
          Reporta un robo y ayuda a tu comunidad a recuperar objetos robados
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card className="bg-dark-card border-dark-border card-glow">
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                Título del Reporte *
              </label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Ej: Robo de bicicleta roja en el centro"
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <div className="flex items-center gap-1 mt-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.title.message}
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium mb-2">
                Categoría *
              </label>
              <Select
                id="category"
                {...register('category')}
                className={errors.category ? 'border-destructive' : ''}
              >
                <option value="">Selecciona una categoría</option>
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Select>
              {errors.category && (
                <div className="flex items-center gap-1 mt-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.category.message}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Descripción Detallada *
              </label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe los detalles del incidente: características del objeto, hora aproximada, circunstancias, etc."
                rows={5}
                className={`min-h-[120px] ${errors.description ? 'border-destructive' : ''}`}
              />
              {errors.description && (
                <div className="flex items-center gap-1 mt-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.description.message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Images */}
        <Card className="bg-dark-card border-dark-border card-glow">
          <CardHeader>
            <CardTitle>Imágenes</CardTitle>
            <CardDescription>
              Sube hasta 5 imágenes del objeto robado (opcional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              <div className="border-2 border-dashed border-dark-border rounded-lg p-8 text-center hover:border-neon-green/50 transition-colors">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={imageFiles.length >= 5 || isUploadingImages}
                  className="hidden"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-foreground/50" />
                  <span className="text-sm text-foreground/70">
                    {imageFiles.length >= 5
                      ? 'Máximo 5 imágenes alcanzado'
                      : 'Haz clic o arrastra imágenes aquí'}
                  </span>
                  <span className="text-xs text-foreground/50">
                    Máximo 10MB por imagen
                  </span>
                </label>
              </div>

              {/* Image Preview Grid */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {imagePreviews.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-dark-border"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 bg-destructive/80 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Location */}
        <Card className="bg-dark-card border-dark-border card-glow">
          <CardHeader>
            <CardTitle>Ubicación</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationSelector
              value={location || { location_name: '', latitude: undefined, longitude: undefined }}
              onChange={handleLocationChange}
              error={errors.location?.location_name?.message}
            />
          </CardContent>
        </Card>

        {/* Section 4: Incident Date */}
        <Card className="bg-dark-card border-dark-border card-glow">
          <CardHeader>
            <CardTitle>Fecha del Incidente</CardTitle>
          </CardHeader>
          <CardContent>
            <VisualDatePicker
              value={incidentDate || ''}
              onChange={handleDateChange}
              error={errors.incidentDate?.message}
            />
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{error.message}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/reportes')}
            className="flex-1"
            disabled={isLoading || isUploadingImages}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="neon"
            className="flex-1 neon-glow"
            disabled={isLoading || isUploadingImages}
          >
            {isLoading ? 'Creando...' : isUploadingImages ? 'Subiendo imágenes...' : 'Crear Reporte'}
          </Button>
        </div>
      </form>
    </div>
  )
}
