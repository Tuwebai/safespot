import { Button, ButtonProps } from '@/components/ui/button'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AsyncButtonProps extends Omit<ButtonProps, 'onClick' | 'onError'> {
    action: () => Promise<unknown>
    onSuccess?: () => void
    onError?: (error: Error) => void
    successLabel?: React.ReactNode
    errorLabel?: React.ReactNode
    hideIcon?: boolean
}

export function AsyncButton({
    action,
    onSuccess,
    onError,
    className,
    children,
    disabled,
    variant = "default",
    successLabel,
    errorLabel,
    hideIcon = false,
    ...props
}: AsyncButtonProps) {
    const { execute, isLoading, isSuccess, isError } = useAsyncAction<[], unknown>(action, {
        onSuccess,
        onError
    })

    // Determine visual state
    let content = children
    let buttonVariant = variant
    const isDisabled = disabled || isLoading

    if (isLoading) {
        content = (
            <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {children}
            </>
        )
    }

    if (isSuccess) {
        buttonVariant = "neon" // Or custom success variant
        content = (
            <>
                {!hideIcon && <Check className="mr-2 h-4 w-4" />}
                {successLabel || children}
            </>
        )
    }

    if (isError) {
        buttonVariant = "destructive"
        content = (
            <>
                {!hideIcon && <X className="mr-2 h-4 w-4" />}
                {errorLabel || 'Error'}
            </>
        )
    }

    return (
        <Button
            onClick={execute}
            disabled={isDisabled}
            variant={buttonVariant}
            className={cn(
                "transition-all duration-300",
                {
                    "bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30": isSuccess && variant !== 'neon', // Custom success style override if needed
                },
                className
            )}
            {...props}
        >
            {content}
        </Button>
    )
}
