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
    const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('error')

    return (
        <AvatarContext.Provider value={{ imageLoadingStatus: status, onImageLoadingStatusChange: setStatus }}>
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

    React.useLayoutEffect(() => {
        if (!src) {
            context?.onImageLoadingStatusChange('error')
            return
        }

        // Reset status to loading when src changes (unless it was already loaded? no, safer to reset)
        // Actually, simply creating a new Image object detects status.
        const img = new Image()
        img.src = src
        img.onload = () => context?.onImageLoadingStatusChange('loaded')
        img.onerror = () => context?.onImageLoadingStatusChange('error')

        // Initial status? 
        // If we want immediate feedback, we can assume 'loading' here but the Effect runs after render.
        // If we want to show fallback immediately, default state 'error' maps to fallback effectively 
        // until loaded.

    }, [src, context])

    // Only render img if loaded
    if (context?.imageLoadingStatus !== 'loaded') return null

    return (
        <img
            ref={ref}
            src={src}
            className={cn("aspect-square h-full w-full", className)}
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
