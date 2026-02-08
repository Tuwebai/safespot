import { useState } from 'react'
import { X, Upload, Trash2, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUpdateAdminAvatar, useDeleteAdminAvatar } from '@/admin/hooks/useAdminProfile'

interface AvatarUploadModalProps {
    isOpen: boolean
    onClose: () => void
    currentAvatarUrl?: string
    onSuccess: () => void
}

export function AvatarUploadModal({ isOpen, onClose, currentAvatarUrl, onSuccess }: AvatarUploadModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const updateMutation = useUpdateAdminAvatar()
    const deleteMutation = useDeleteAdminAvatar()

    if (!isOpen) return null

    const validateFile = (file: File): string | null => {
        // Validar tamaño (2MB)
        if (file.size > 2 * 1024 * 1024) {
            return 'La imagen debe ser menor a 2MB'
        }

        // Validar formato
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            return 'Formato no soportado. Usa JPG, PNG o WebP'
        }

        return null
    }

    const handleFileSelect = (file: File) => {
        const validationError = validateFile(file)
        if (validationError) {
            setError(validationError)
            return
        }

        setError(null)
        setSelectedFile(file)

        // Create preview
        const reader = new FileReader()
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const file = e.dataTransfer.files[0]
        if (file) {
            handleFileSelect(file)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFileSelect(file)
        }
    }

    const handleUpload = async () => {
        if (!selectedFile) return

        try {
            await updateMutation.mutateAsync(selectedFile)
            onSuccess()
            handleClose()
        } catch (err) {
            setError('Error al subir la imagen. Intenta de nuevo.')
        }
    }

    const handleDelete = async () => {
        if (!currentAvatarUrl) return

        if (!confirm('¿Estás seguro de eliminar tu foto de perfil?')) return

        try {
            await deleteMutation.mutateAsync()
            onSuccess()
            handleClose()
        } catch (err) {
            setError('Error al eliminar la imagen.')
        }
    }

    const handleClose = () => {
        setSelectedFile(null)
        setPreviewUrl(null)
        setError(null)
        setIsDragging(false)
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Cambiar foto de perfil</h3>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-white transition-colors"
                        disabled={updateMutation.isPending || deleteMutation.isPending}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Preview or Drag & Drop Zone */}
                <div className="mb-4">
                    {previewUrl ? (
                        <div className="relative">
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-64 object-cover rounded-lg border border-[#334155]"
                            />
                            <button
                                onClick={() => {
                                    setSelectedFile(null)
                                    setPreviewUrl(null)
                                }}
                                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                    ? 'border-[#00ff88] bg-[#00ff88]/5'
                                    : 'border-[#334155] hover:border-[#00ff88]/50'
                                }`}
                        >
                            <Camera className="h-12 w-12 text-slate-500 mx-auto mb-3" />
                            <p className="text-slate-400 mb-2">Arrastra una imagen aquí</p>
                            <p className="text-xs text-slate-500 mb-4">o</p>
                            <label className="cursor-pointer">
                                <span className="text-[#00ff88] hover:underline text-sm">
                                    Selecciona un archivo
                                </span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleInputChange}
                                    className="hidden"
                                />
                            </label>
                            <p className="text-xs text-slate-500 mt-3">
                                JPG, PNG o WebP (máx. 2MB)
                            </p>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {currentAvatarUrl && !selectedFile && (
                        <Button
                            variant="outline"
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar foto'}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={updateMutation.isPending || deleteMutation.isPending}
                        className="flex-1"
                    >
                        Cancelar
                    </Button>

                    <Button
                        onClick={handleUpload}
                        disabled={!selectedFile || updateMutation.isPending}
                        className="flex-1 bg-[#00ff88] text-black hover:bg-[#00cc6a]"
                    >
                        {updateMutation.isPending ? (
                            'Subiendo...'
                        ) : (
                            <>
                                <Upload className="h-4 w-4 mr-2" />
                                Guardar
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
