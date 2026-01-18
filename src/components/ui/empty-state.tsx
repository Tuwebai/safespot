
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Search, ShieldAlert, Map, MessageSquare, Users, EyeOff } from "lucide-react"

export type EmptyStateVariant = 'default' | 'search' | 'permission' | 'error' | 'success' | 'map' | 'community' | 'messages'

interface EmptyStateProps {
    variant?: EmptyStateVariant
    title: string
    description: string
    action?: {
        label: string
        onClick: () => void
        variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "neon"
    }
    icon?: React.ElementType
    className?: string
    fullScreen?: boolean
}

// Map variants to default icons and colors
const variantConfig: Record<EmptyStateVariant, { icon: React.ElementType, color: string }> = {
    default: { icon: ShieldAlert, color: "text-muted-foreground" },
    search: { icon: Search, color: "text-neon-green" },
    permission: { icon: EyeOff, color: "text-amber-500" },
    error: { icon: ShieldAlert, color: "text-red-500" },
    success: { icon: ShieldAlert, color: "text-green-500" }, // Fallback, usually bespoke
    map: { icon: Map, color: "text-blue-500" },
    community: { icon: Users, color: "text-purple-500" },
    messages: { icon: MessageSquare, color: "text-pink-500" }
}

export function EmptyState({
    variant = 'default',
    title,
    description,
    action,
    icon,
    className,
    fullScreen = false
}: EmptyStateProps) {

    const config = variantConfig[variant]
    const IconComponent = icon || config.icon
    const iconColor = config.color

    return (
        <div className={cn(
            "flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-300",
            fullScreen ? "min-h-[60vh]" : "min-h-[300px]",
            className
        )}>
            {/* Animated Icon Circle */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-6",
                    "bg-card border border-border shadow-2xl relative"
                )}
            >
                {/* Glow Effect */}
                <div className={cn("absolute inset-0 rounded-full opacity-20 blur-xl", iconColor.replace('text-', 'bg-'))} />

                <IconComponent className={cn("w-10 h-10 relative z-10", iconColor)} strokeWidth={1.5} />
            </motion.div>

            {/* Text Content */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="max-w-md space-y-2"
            >
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                    {description}
                </p>
            </motion.div>

            {/* Primary Action */}
            {action && (
                <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-8"
                >
                    <Button
                        onClick={action.onClick}
                        variant={action.variant || "default"}
                        className={cn(
                            "min-w-[140px]",
                            variant === 'search' ? "hover:scale-105 transition-transform" : ""
                        )}
                    >
                        {action.label}
                    </Button>
                </motion.div>
            )}
        </div>
    )
}
