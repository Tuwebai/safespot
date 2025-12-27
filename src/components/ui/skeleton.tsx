import * as React from "react"
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    width?: string | number
    height?: string | number
    radius?: string
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
    ({ className, width, height, radius, style, ...props }, ref) => {
        const skeletonStyle: React.CSSProperties = {
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
            borderRadius: radius,
            ...style
        }

        return (
            <div
                ref={ref}
                className={cn("skeleton", className)}
                style={skeletonStyle}
                {...props}
            />
        )
    }
)
Skeleton.displayName = "Skeleton"

export { Skeleton }
