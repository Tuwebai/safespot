import { useState, useCallback } from 'react'
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

export function ReportImages({ imageUrls }: ReportImagesProps) {
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())

    const handleImageError = useCallback((imageUrl: string) => {
        setFailedImageUrls(prev => new Set(prev).add(imageUrl))
    }, [])

    return (
        <Card className="card-glow bg-dark-card border-dark-border mb-6">
            <CardHeader>
                <CardTitle>Imágenes</CardTitle>
            </CardHeader>
            <CardContent>
                {imageUrls.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {imageUrls.map((imageUrl, index) => {
                            const hasFailed = failedImageUrls.has(imageUrl)
                            const imageKey = `image-${imageUrl.substring(0, 50)}-${index}`

                            return (
                                <div
                                    key={imageKey}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-dark-border bg-dark-bg"
                                >
                                    {!hasFailed ? (
                                        <img
                                            src={imageUrl}
                                            alt={`Imagen ${index + 1} del reporte`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={() => handleImageError(imageUrl)}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-dark-bg">
                                            <div className="text-center p-4">
                                                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                                                <p className="text-xs text-muted-foreground">Imagen no disponible</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">Este reporte no tiene imágenes</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
