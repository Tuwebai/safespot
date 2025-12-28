import { useState, useCallback, CSSProperties } from 'react'

interface OptimizedImageProps {
    src: string
    alt: string
    aspectRatio?: number // width / height (e.g., 16/9 = 1.78)
    priority?: boolean   // For above-the-fold images (disables lazy loading)
    className?: string
    sizes?: string       // Custom sizes attribute override
}

/**
 * Performance-optimized image component for feed images.
 * 
 * Improvements over raw <img>:
 * - Lazy loading (unless priority)
 * - Async decoding (off main thread)
 * - srcset for responsive images (reduces bandwidth on mobile)
 * - Skeleton placeholder (eliminates CLS)
 * - Graceful error fallback (no broken image icons)
 */
export function OptimizedImage({
    src,
    alt,
    aspectRatio = 16 / 9,
    priority = false,
    className = '',
    sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
}: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)

    // Generate srcset for responsive loading
    // Assumes backend/CDN can serve different sizes or browser will pick closest
    const generateSrcSet = useCallback((baseSrc: string): string => {
        // If src already has query params, append with &, otherwise with ?
        const separator = baseSrc.includes('?') ? '&' : '?'

        // Common breakpoints for feed cards
        // Note: If your CDN supports on-the-fly resizing (Cloudinary, imgix, Supabase Transform),
        // replace this with actual resize params. Otherwise, browser uses these as hints.
        return [
            `${baseSrc}${separator}w=400 400w`,
            `${baseSrc}${separator}w=800 800w`,
            `${baseSrc}${separator}w=1200 1200w`
        ].join(', ')
    }, [])

    const handleLoad = useCallback(() => {
        setIsLoaded(true)
    }, [])

    const handleError = useCallback(() => {
        setHasError(true)
        setIsLoaded(true) // Hide skeleton on error too
    }, [])

    // Wrapper style to reserve space and prevent CLS
    const wrapperStyle: CSSProperties = {
        position: 'relative',
        width: '100%',
        aspectRatio: `${aspectRatio}`,
        overflow: 'hidden',
        backgroundColor: 'var(--color-dark-card, #1a1a2e)' // Fallback skeleton color
    }

    // Skeleton pulse animation style
    const skeletonStyle: CSSProperties = {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
        backgroundSize: '200% 100%',
        animation: isLoaded ? 'none' : 'shimmer 1.5s infinite',
        opacity: isLoaded ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        pointerEvents: 'none'
    }

    // Image style
    const imageStyle: CSSProperties = {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: isLoaded && !hasError ? 1 : 0,
        transition: 'opacity 0.3s ease-out'
    }

    // Error fallback style
    const errorFallbackStyle: CSSProperties = {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-dark-bg, #0f0f1a)',
        color: 'var(--color-muted-foreground, #6b7280)'
    }

    return (
        <div style={wrapperStyle} className={className}>
            {/* Skeleton shimmer overlay */}
            <div style={skeletonStyle} aria-hidden="true" />

            {/* Actual image */}
            {!hasError && (
                <img
                    src={src}
                    srcSet={generateSrcSet(src)}
                    sizes={sizes}
                    alt={alt}
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                    onLoad={handleLoad}
                    onError={handleError}
                    style={imageStyle}
                    // fetchpriority for LCP images (Chrome 102+)
                    {...(priority ? { fetchpriority: 'high' } : {})}
                />
            )}

            {/* Error fallback */}
            {hasError && (
                <div style={errorFallbackStyle}>
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </div>
            )}
        </div>
    )
}

// Add shimmer keyframes to global styles if not already present
// This should ideally be in index.css, but we inject it here for encapsulation
if (typeof document !== 'undefined') {
    const styleId = 'optimized-image-styles'
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `
        document.head.appendChild(style)
    }
}
