import { Upload, X, Eye, FileText, MapPin, Calendar, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WizardFormData } from './useReportWizard'
import { formatDistanceToNow } from '@/lib/date-utils'

interface Step4ReviewSubmitProps {
    formData: WizardFormData
    imageFiles: File[]
    imagePreviews: string[]
    isSubmitting: boolean
    isCompressing: boolean
    compressionProgress: string
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    onRemoveImage: (index: number) => void
    onSubmit: () => void
}

export function Step4ReviewSubmit({
    formData,
    imageFiles,
    imagePreviews,
    isSubmitting,
    isCompressing,
    compressionProgress,
    onImageUpload,
    onRemoveImage,
    onSubmit
}: Step4ReviewSubmitProps) {
    const canSubmit = !isSubmitting && !isCompressing

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                    Revisá y publicá
                </h2>
                <p className="text-slate-400">
                    Verificá que todo esté correcto antes de publicar
                </p>
            </div>

            {/* Preview Card */}
            <div className="bg-[#0f172a] border border-[#334155] rounded-xl overflow-hidden">
                <div className="bg-[#1e293b]/50 px-4 py-3 border-b border-[#334155]">
                    <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-[#00ff88]" />
                        <span className="text-sm font-medium text-white">Vista previa del reporte</span>
                    </div>
                </div>
                
                <div className="p-4 space-y-4">
                    {/* Title & Category */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                                {formData.category}
                            </Badge>
                        </div>
                        <h3 className="text-lg font-bold text-white">
                            {formData.title}
                        </h3>
                    </div>

                    {/* Description */}
                    <div className="bg-[#020617] rounded-lg p-3">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">
                            {formData.description}
                        </p>
                    </div>

                    {/* Location & Date */}
                    <div className="flex flex-col sm:flex-row gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-400">
                            <MapPin className="h-4 w-4 text-[#00ff88]" />
                            <span className="truncate">{formData.location?.location_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Calendar className="h-4 w-4 text-[#00ff88]" />
                            <span>{new Date(formData.incidentDate).toLocaleDateString('es-AR')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Images Upload */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">
                        Imágenes (opcional)
                    </h3>
                    <span className="text-xs text-slate-500">
                        {imageFiles.length}/5
                    </span>
                </div>

                {/* Upload Zone */}
                {imageFiles.length < 5 && (
                    <div className="border-2 border-dashed border-[#334155] rounded-lg p-6 text-center hover:border-[#00ff88]/50 transition-colors">
                        <input
                            type="file"
                            id="wizard-image-upload"
                            accept="image/*"
                            multiple
                            onChange={onImageUpload}
                            disabled={imageFiles.length >= 5 || isCompressing}
                            className="hidden"
                        />
                        <label
                            htmlFor="wizard-image-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                        >
                            <Upload className="h-8 w-8 text-slate-500" />
                            <span className="text-sm text-slate-400">
                                {isCompressing ? compressionProgress : 'Haz clic para subir imágenes'}
                            </span>
                            <span className="text-xs text-slate-600">
                                JPG, PNG. Máx 15MB por imagen
                            </span>
                        </label>
                    </div>
                )}

                {/* Preview Grid */}
                {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {imagePreviews.map((url, index) => (
                            <div key={index} className="relative group aspect-square">
                                <img
                                    src={url}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover rounded-lg border border-[#334155]"
                                />
                                <button
                                    type="button"
                                    onClick={() => onRemoveImage(index)}
                                    disabled={isSubmitting}
                                    className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
                <Button
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    variant="neon"
                    className="w-full py-6 text-lg neon-glow"
                >
                    {isSubmitting ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Publicando...
                        </span>
                    ) : (
                        'Publicar Reporte'
                    )}
                </Button>
                
                <p className="text-center text-xs text-slate-500 mt-3">
                    Tu reporte será visible públicamente para la comunidad
                </p>
            </div>
        </div>
    )
}
