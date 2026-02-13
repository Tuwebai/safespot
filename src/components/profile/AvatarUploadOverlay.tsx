/**
 * 🏛️ SAFE MODE: AvatarUploadOverlay - Enterprise Grade
 * 
 * Componente de overlay para subir avatar en hover.
 * 
 * Features:
 * - Hover state con transición suave
 * - Validación de archivo antes de upload
 * - Estados de loading/error
 * - Accesibilidad (keyboard navigation)
 * - Theme-aware styling (sin hardcoded colors)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUploadAvatarMutation, validateAvatarFile } from '@/hooks/mutations/useUploadAvatarMutation';
import { useDeleteAvatarMutation } from '@/hooks/mutations/useDeleteAvatarMutation';
import { useAuthStore } from '@/store/authStore';

interface AvatarUploadOverlayProps {
    /** URL actual del avatar (si existe) */
    currentAvatarUrl?: string | null;
    /** Si el usuario está autenticado (solo autenticados pueden subir) */
    isAuthenticated: boolean;
    /** Callback cuando el upload es exitoso */
    onSuccess?: () => void;
    /** Clases adicionales para el contenedor */
    className?: string;
    /** Tamaño del avatar ('sm' | 'md' | 'lg' | 'xl') */
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24',
};

const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
};

/**
 * AvatarUploadOverlay
 * 
 * Muestra un overlay sobre el avatar al hacer hover que permite:
 - Subir nueva imagen (click o drop)
 - Eliminar avatar existente
 */
export function AvatarUploadOverlay({
    currentAvatarUrl,
    isAuthenticated,
    onSuccess,
    className,
    size = 'lg',
}: AvatarUploadOverlayProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // 🏛️ DEFENSIVE: Verify actual auth state from store
    const { isAuthenticated: storeAuthenticated } = useAuthStore();
    const actuallyAuthenticated = isAuthenticated && storeAuthenticated;

    const uploadMutation = useUploadAvatarMutation({
        onSuccess: () => {
            setIsHovered(false);
            onSuccess?.();
        },
        onError: () => {
            // Silently fail during auth transitions
            setIsHovered(false);
        }
    });

    const deleteMutation = useDeleteAvatarMutation({
        onSuccess: () => {
            setIsHovered(false);
            onSuccess?.();
        },
        onError: () => {
            // Silently fail during auth transitions
            setIsHovered(false);
        }
    });

    // Solo mostrar overlay si está autenticado (double check)
    if (!actuallyAuthenticated) {
        return null;
    }

    const handleFileSelect = useCallback((file: File) => {
        // 🏛️ DEFENSIVE: Don't upload during auth transition
        if (!actuallyAuthenticated) {
            console.warn('[AvatarUploadOverlay] Upload blocked: not authenticated');
            return;
        }
        
        setValidationError(null);
        
        const validation = validateAvatarFile(file);
        if (!validation.valid) {
            setValidationError(validation.error ?? null);
            return;
        }

        uploadMutation.mutate(file);
    }, [uploadMutation, actuallyAuthenticated]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
        // Reset input para permitir re-seleccionar el mismo archivo
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = () => {
        setDragActive(false);
    };

    const handleDelete = () => {
        if (!currentAvatarUrl) return;
        
        // 🏛️ DEFENSIVE: Don't delete during auth transition
        if (!actuallyAuthenticated) {
            console.warn('[AvatarUploadOverlay] Delete blocked: not authenticated');
            return;
        }
        
        if (confirm('¿Estás seguro de eliminar tu foto de perfil?')) {
            deleteMutation.mutate();
        }
    };

    const isLoading = uploadMutation.isPending || deleteMutation.isPending;
    
    // 🏛️ DEFENSIVE: Cleanup on unmount
    useEffect(() => {
        return () => {
            setIsHovered(false);
            setDragActive(false);
            setValidationError(null);
        };
    }, []);

    return (
        <div
            className={cn(
                'absolute inset-0 rounded-full overflow-hidden cursor-pointer',
                sizeClasses[size],
                className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setDragActive(false);
                setValidationError(null);
            }}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            aria-label="Cambiar foto de perfil"
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                }
            }}
        >
            {/* Overlay semitransparente */}
            <div
                className={cn(
                    'absolute inset-0 bg-background/80 backdrop-blur-sm transition-all duration-200 flex flex-col items-center justify-center gap-1',
                    (isHovered || dragActive) && !isLoading ? 'opacity-100' : 'opacity-0',
                    dragActive && 'bg-primary/20'
                )}
            >
                {isLoading ? (
                    <Loader2 
                        className="animate-spin text-primary" 
                        size={iconSizes[size]} 
                    />
                ) : (
                    <>
                        <Camera 
                            className={cn(
                                'text-primary transition-transform',
                                dragActive && 'scale-110'
                            )} 
                            size={iconSizes[size]} 
                        />
                        <span className="text-[10px] text-primary font-medium">
                            {dragActive ? 'Suelta aquí' : 'Cambiar'}
                        </span>
                    </>
                )}
            </div>

            {/* Botón eliminar (solo si hay avatar) */}
            {currentAvatarUrl && isHovered && !isLoading && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                    }}
                    className={cn(
                        'absolute -top-1 -right-1 p-1 rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90 transition-all z-10',
                        size === 'sm' && '-top-0.5 -right-0.5 p-0.5'
                    )}
                    title="Eliminar foto"
                    aria-label="Eliminar foto de perfil"
                >
                    <X size={size === 'sm' ? 10 : size === 'xl' ? 16 : 12} />
                </button>
            )}

            {/* Error de validación */}
            {validationError && isHovered && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-[10px] text-destructive bg-destructive/10 px-2 py-1 rounded">
                        {validationError}
                    </span>
                </div>
            )}

            {/* Input file oculto */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleInputChange}
                className="hidden"
                aria-hidden="true"
            />
        </div>
    );
}
