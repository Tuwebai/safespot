

export function StatusIndicator() {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-bg/50 border border-dark-border/50 text-xs font-medium text-foreground/80 hover:bg-dark-border/50 transition-colors cursor-default group">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="group-hover:text-foreground transition-colors">
                Systems Normal
            </span>
        </div>
    )
}
