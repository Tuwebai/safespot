import * as React from "react"
import { cn } from "@/lib/utils"

type AvatarContextValue = {
    imageLoadingStatus: 'loading' | 'loaded' | 'error'
    onImageLoadingStatusChange: (status: 'loading' | 'loaded' | 'error') => void
}

const AvatarContext = React.createContext<AvatarContextValue | undefined>(undefined)

const Avatar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading')

    const contextValue = React.useMemo(() => ({ 
        imageLoadingStatus: status, 
        onImageLoadingStatusChange: setStatus 
    }), [status])

    return (
        <AvatarContext.Provider value={contextValue}>
            <div
                ref={ref}
                className={cn(
                    "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        </AvatarContext.Provider>
    )
})
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
    HTMLImageElement,
    React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, src, ...props }, ref) => {
    const context = React.useContext(AvatarContext)
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])
    
    // Fix: Use ref to track src changes and prevent dependency loop with context
    const prevSrc = React.useRef(src)
    
    React.useLayoutEffect(() => {
        if (mounted && prevSrc.current !== src) {
            prevSrc.current = src
            if (context?.imageLoadingStatus !== 'loading') {
                context?.onImageLoadingStatusChange('loading')
            }
        }
    }, [src, mounted, context])

    React.useLayoutEffect(() => {
        if (!src) {
            // Only update if not already error to prevent loop
            if (context?.imageLoadingStatus !== 'error') {
                context?.onImageLoadingStatusChange('error')
            }
            return
        }

        const img = new Image()
        img.src = src

        if (img.complete) {
            const newStatus = img.naturalWidth > 0 ? 'loaded' : 'error'
            if (context?.imageLoadingStatus !== newStatus) {
                context?.onImageLoadingStatusChange(newStatus)
            }
            return
        }

        img.onload = () => {
             if (context?.imageLoadingStatus !== 'loaded') {
                context?.onImageLoadingStatusChange('loaded')
             }
        }
        img.onerror = () => {
            if (context?.imageLoadingStatus !== 'error') {
                context?.onImageLoadingStatusChange('error')
            }
        }
        
    }, [src, context]) // Keep context here but guarded logic prevents updates if same

    // Render img if loaded OR if we want to let the browser try during 'loading'
    if (context?.imageLoadingStatus === 'error') return null

    return (
        <img
            ref={ref}
            src={src}
            className={cn("aspect-square h-full w-full", className)}
            loading="lazy"
            decoding="async"
            {...props}
        />
    )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    const context = React.useContext(AvatarContext)

    // Hide fallback if image is loaded
    if (context?.imageLoadingStatus === 'loaded') return null

    return (
        <div
            ref={ref}
            className={cn(
                "flex h-full w-full items-center justify-center rounded-full bg-muted",
                className
            )}
            {...props}
        />
    )
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
