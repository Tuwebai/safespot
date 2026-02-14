import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Z_INDEX } from '@/config/z-index';

interface MapLayoutProps {
    children: ReactNode
    className?: string
}

export function MapLayout({ children, className }: MapLayoutProps) {
    return (
        <div className={cn("fixed inset-0 bg-background overflow-hidden", className)} style={{ zIndex: Z_INDEX.MODAL_CONTENT }}>
            {children}
        </div>
    )
}
