import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Image as ImageIcon } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'

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
                            const imageKey = `image-${imageUrl.substring(0, 50)}-${index}`

                            return (
                                <div
                                    key={imageKey}
                                    className="rounded-xl overflow-hidden border border-dark-border/50 group"
                                >
                                    <OptimizedImage
                                        src={imageUrl}
                                        alt={`Imagen ${index + 1} del reporte`}
                                        aspectRatio={4 / 3}
                                        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                                    />
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
