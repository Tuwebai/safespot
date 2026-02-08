
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    children: React.ReactNode
    className?: string
    trigger?: React.ReactNode
}

export function Modal({
    open,
    onOpenChange,
    title,
    description,
    children,
    className = '',
    trigger
}: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onOpenChange(false)
        }

        if (open) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [open, onOpenChange])

    return (
        <>
            {/* Trigger element */}
            {trigger && (
                <div onClick={() => onOpenChange(true)} className="inline-block">
                    {trigger}
                </div>
            )}

            {/* Modal content */}
            {open && createPortal(
                <div className="fixed inset-0 z-[50] flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        ref={overlayRef}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={(e) => {
                            if (e.target === overlayRef.current) onOpenChange(false)
                        }}
                    />

                    {/* Content */}
                    <div className={`
                        relative bg-[#0f172a] border border-[#1e293b] text-white 
                        rounded-lg shadow-lg w-full max-w-lg p-6 
                        animate-in zoom-in-95 duration-200
                        ${className}
                    `}>
                        <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
                            <h2 className="text-lg font-semibold leading-none tracking-tight">
                                {title}
                            </h2>
                            {description && (
                                <p className="text-sm text-slate-400">
                                    {description}
                                </p>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </Button>

                        {children}
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
