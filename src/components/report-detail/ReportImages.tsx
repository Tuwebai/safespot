import { useState, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Image as ImageIcon } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface ReportImagesProps {
    imageUrls: string[]
}

// ============================================
// COMPONENT
// ============================================

export const ReportImages = memo(function ReportImages({ imageUrls }: ReportImagesProps) {
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())

    const handleImageError = useCallback((imageUrl: string) => {
        setFailedImageUrls(prev => new Set(prev).add(imageUrl))
    }, [])

    return (
        <Card className="bg-dark-card border-dark-border shadow-sm">
            <CardHeader className="pb-3 border-b border-dark-border/50 mb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-neon-green" />
                    Imágenes del suceso
                </CardTitle>
            </CardHeader>
            <CardContent>
                {imageUrls.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {imageUrls.map((imageUrl, index) => {
                            const hasFailed = failedImageUrls.has(imageUrl)
                            const imageKey = `image-${imageUrl.substring(0, 50)}-${index}`

                            return (
                                <div
                                    key={imageKey}
                                    className="relative aspect-[4/3] rounded-xl overflow-hidden border border-dark-border/50 bg-dark-bg/50 group"
                                >
                                    {!hasFailed ? (
                                        <img
                                            src={imageUrl}
                                            alt={`Imagen ${index + 1} del reporte`}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            loading="lazy"
                                            onError={() => handleImageError(imageUrl)}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-dark-bg/30">
                                            <div className="text-center p-4">
                                                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                                <p className="text-xs text-muted-foreground/50">Imagen no disponible</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 bg-dark-bg/20 rounded-xl border border-dashed border-dark-border">
                        <ImageIcon className="h-12 w-12 mb-3 text-muted-foreground/20" />
                        <p className="text-sm font-medium text-muted-foreground/50">Este reporte no contiene evidencia fotográfica</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
})
