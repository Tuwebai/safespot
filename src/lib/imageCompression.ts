/**
 * Image Compression Utility
 * 
 * Client-side image compression before upload to reduce:
 * - Mobile data usage
 * - Upload time
 * - Storage costs
 * 
 * Uses browser-image-compression with WebWorker for non-blocking compression.
 */

import imageCompression from 'browser-image-compression'

// ============================================
// CONFIGURATION
// ============================================

const COMPRESSION_OPTIONS = {
    maxSizeMB: 0.8,           // Target max size (800KB)
    maxWidthOrHeight: 1600,   // Max dimension (good for mobile viewing)
    useWebWorker: true,       // Non-blocking compression
    fileType: 'image/webp',   // Modern format, smaller size
    initialQuality: 0.85,     // Quality level (0.85 = good balance)
    alwaysKeepResolution: false,
    preserveExif: false,      // Strip EXIF for privacy/size
}

const THUMBNAIL_OPTIONS = {
    maxSizeMB: 0.1,           // 100KB for thumbnails
    maxWidthOrHeight: 400,    // Small for list views
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.7,
    preserveExif: false,
}

// ============================================
// TYPES
// ============================================

export interface CompressionResult {
    file: File
    originalSize: number
    compressedSize: number
    compressionRatio: number  // e.g., 0.15 = 85% reduction
    width?: number
    height?: number
}

export interface CompressionProgress {
    fileIndex: number
    fileName: string
    progress: number  // 0-100
}

// ============================================
// COMPRESSION FUNCTIONS
// ============================================

/**
 * Compress a single image
 * Returns the compressed file with metadata
 */
export async function compressImage(
    file: File,
    onProgress?: (progress: number) => void
): Promise<CompressionResult> {
    const originalSize = file.size

    try {
        const compressedFile = await imageCompression(file, {
            ...COMPRESSION_OPTIONS,
            onProgress: onProgress,
        })

        // Rename to .webp extension
        const newName = file.name.replace(/\.\w+$/, '.webp')
        const finalFile = new File([compressedFile], newName, {
            type: 'image/webp',
        })

        return {
            file: finalFile,
            originalSize,
            compressedSize: finalFile.size,
            compressionRatio: finalFile.size / originalSize,
        }
    } catch (error) {
        console.error('Image compression failed:', error)
        // Fallback: return original file
        return {
            file,
            originalSize,
            compressedSize: file.size,
            compressionRatio: 1,
        }
    }
}

/**
 * Compress multiple images with progress tracking
 */
export async function compressImages(
    files: File[],
    onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult[]> {
    const results: CompressionResult[] = []

    for (let i = 0; i < files.length; i++) {
        const file = files[i]

        const result = await compressImage(file, (progress) => {
            onProgress?.({
                fileIndex: i,
                fileName: file.name,
                progress,
            })
        })

        results.push(result)
    }

    return results
}

/**
 * Create a thumbnail from an image
 */
export async function createThumbnail(file: File): Promise<File> {
    try {
        const compressed = await imageCompression(file, THUMBNAIL_OPTIONS)
        const newName = file.name.replace(/\.\w+$/, '_thumb.webp')
        return new File([compressed], newName, { type: 'image/webp' })
    } catch (error) {
        console.error('Thumbnail creation failed:', error)
        return file
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format bytes to human readable string
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Calculate total compression savings
 */
export function calculateSavings(results: CompressionResult[]): {
    totalOriginal: number
    totalCompressed: number
    savingsPercent: number
} {
    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0)
    const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0)
    const savingsPercent = totalOriginal > 0
        ? ((1 - totalCompressed / totalOriginal) * 100)
        : 0

    return { totalOriginal, totalCompressed, savingsPercent }
}

/**
 * Check if file needs compression
 */
export function needsCompression(file: File): boolean {
    // Compress if over 500KB or not WebP
    return file.size > 500 * 1024 || !file.type.includes('webp')
}
