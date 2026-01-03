import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { LocationSelector } from '@/components/LocationSelector'
import { VisualDatePicker } from '@/components/VisualDatePicker'

import { ALL_CATEGORIES } from '@/lib/constants'
import { AlertCircle, Upload, X } from 'lucide-react'
import { useCreateReportForm } from '@/hooks/useCreateReportForm'

export function CrearReporte() {
  const navigate = useNavigate()

  const {
    form: {
      register,
      formState: { errors },
      watch
    },
    imageFiles,
    imagePreviews,
    isSubmitting,
    submitError,

    // Actions
    handleLocationChange,
    handleDateChange,
    handleImageUpload,
    handleRemoveImage,
    submit
  } = useCreateReportForm()

  const location = watch('location')
  const incidentDate = watch('incidentDate')

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

      <form onSubmit={submit} className="space-y-6">
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
                disabled={isSubmitting}
                autoComplete="off"
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                  disabled={imageFiles.length >= 5 || isSubmitting}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                        disabled={isSubmitting}
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

        {/* Section 3: Location - REFACTORED FOR ZONE DETECTION */}
        <Card className="bg-dark-card border-dark-border card-glow">
          <CardHeader>
            <CardTitle>Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* Global Error Display */}
        {submitError && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{submitError.message}</span>
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
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="neon"
            className="flex-1 neon-glow"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creando...' : 'Crear Reporte'}
          </Button>
        </div>
      </form>
    </div>
  )
}
