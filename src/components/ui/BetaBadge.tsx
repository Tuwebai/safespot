import { cn } from '@/lib/utils';

export function BetaBadge({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center px-2 py-0.5 ml-2 text-[10px] font-bold tracking-widest rounded-full",
                "bg-neon-green/10 text-neon-green border border-neon-green/30",
                "cursor-help select-none uppercase",
                className
            )}
            title="Estás usando una versión beta. Algunas funciones pueden cambiar."
        >
            BETA
        </span>
    );
}
