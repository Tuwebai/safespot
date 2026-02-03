import { memo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ImagePlus, X, Image as ImageIcon } from 'lucide-react'
import type { Report } from '@/lib/schemas'
import type { useReportEditor } from '@/hooks/useReportEditor'

// ============================================
// TYPES
// ============================================

interface ReportDescriptionProps {
    report: Report
    editor: ReturnType<typeof useReportEditor>
}

// ============================================
// COMPONENT
// ============================================

export const ReportDescription = memo(function ReportDescription({ report, editor }: ReportDescriptionProps) {
    const {
        isEditing,
        editTitle,
        editDescription,
        updating,
        newImages,
        imageUploadError,
        setImageUploadError,
        setTitle,
        setDescription,
        setNewImages
    } = editor

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files)
            setNewImages([...newImages, ...filesArray])
        }
    }, [newImages, setNewImages])

    const removeNewImage = useCallback((index: number) => {
        const updatedImages = [...newImages]
        updatedImages.splice(index, 1)
        setNewImages(updatedImages)
    }, [newImages, setNewImages])

    return (
        <>
            {/* Edit form fields (title/status) - shown in header area when editing */}
            {isEditing && (
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground/80 mb-2">
                                Título
                            </label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Título del reporte"
                                className="bg-dark-bg border-dark-border"
                                disabled={updating}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Description Card */}
            <Card className="card-glow bg-dark-card border-dark-border mb-6">
                <CardHeader>
                    <CardTitle>Descripción</CardTitle>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground/80 mb-2">
                                    Detalles del incidente
                                </label>
                                <Textarea
                                    value={editDescription}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Descripción del reporte"
                                    className="bg-dark-bg border-dark-border min-h-[150px] resize-none"
                                    disabled={updating}
                                />
                            </div>

                            {/* Image Upload Section */}
                            <div className="pt-4 border-t border-dark-border">
                                <label className="block text-sm font-medium text-foreground/80 mb-3">
                                    Añadir imágenes (recomendado)
                                </label>

                                {imageUploadError && (
                                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-500 text-xs font-medium flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            {imageUploadError}
                                        </div>
                                        <button
                                            onClick={() => setImageUploadError(null)}
                                            className="hover:bg-red-500/20 p-1 rounded transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {/* New Images Previews */}
                                    {newImages.map((file, index) => (
                                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-neon-green/30 bg-dark-bg">
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                                decoding="async"
                                            />
                                            <button
                                                onClick={() => removeNewImage(index)}
                                                className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 rounded-full text-white transition-colors"
                                                title="Eliminar imagen"
                                                disabled={updating}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-neon-green/80 text-dark-bg text-[10px] font-bold rounded">
                                                NUEVA
                                            </div>
                                        </div>
                                    ))}

                                    {/* Upload Button */}
                                    <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-dark-border hover:border-neon-green/50 hover:bg-neon-green/5 transition-all cursor-pointer group">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                            disabled={updating}
                                        />
                                        <ImagePlus className="h-6 w-6 text-foreground/40 group-hover:text-neon-green transition-colors mb-2" />
                                        <span className="text-[10px] text-foreground/60 group-hover:text-foreground transition-colors font-medium">
                                            Subir fotos
                                        </span>
                                    </label>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                                    <ImageIcon className="h-3 w-3" />
                                    Podés añadir hasta 5 imágenes en formato JPG, PNG o WebP (máx. 5MB cada una).
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                            {report.description}
                        </p>
                    )}
                </CardContent>
            </Card>
        </>
    )
})
