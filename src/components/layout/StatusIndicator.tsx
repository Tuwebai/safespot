

export function StatusIndicator() {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border/50 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-default group">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="group-hover:text-foreground transition-colors">
                Systems Normal
            </span>
        </div>
    )
}
