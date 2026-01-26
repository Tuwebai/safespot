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

        // Reset to loading on src change to allow retry
        context?.onImageLoadingStatusChange('loading')

        const img = new Image()
        img.src = src

        if (img.complete) {
            if (img.naturalWidth > 0) {
                context?.onImageLoadingStatusChange('loaded')
            } else {
                context?.onImageLoadingStatusChange('error')
            }
            return
        }

        img.onload = () => context?.onImageLoadingStatusChange('loaded')
        img.onerror = () => context?.onImageLoadingStatusChange('error')

    }, [src, context])

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
