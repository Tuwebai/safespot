import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MapLayoutProps {
    children: ReactNode
    className?: string
}

export function MapLayout({ children, className }: MapLayoutProps) {
    return (
        <div className={cn("fixed inset-0 z-[100] bg-background overflow-hidden", className)}>
            {children}
        </div>
    )
}
