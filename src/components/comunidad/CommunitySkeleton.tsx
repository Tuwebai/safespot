/**
 * 🏛️ SAFE MODE: CommunitySkeleton - Loading State Simple
 * 
 * Shimmer cards para loading state.
 * Sin arquitectura compleja, solo visual feedback.
 * 
 * @version 1.0 - Minimalista
 */

export function CommunitySkeleton() {
    return (
        <div className="space-y-4">
            {/* Header shimmer */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="space-y-2">
                    <div className="w-32 h-6 rounded bg-muted animate-pulse" />
                    <div className="w-48 h-4 rounded bg-muted animate-pulse" />
                </div>
            </div>

            {/* Tabs shimmer */}
            <div className="flex justify-center mb-6">
                <div className="flex gap-2 p-1 bg-card border border-border rounded-full">
                    <div className="w-32 h-9 rounded-full bg-muted animate-pulse" />
                    <div className="w-24 h-9 rounded-full bg-muted animate-pulse" />
                </div>
            </div>

            {/* User cards shimmer - 3 items */}
            {[1, 2, 3].map((i) => (
                <div 
                    key={i}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                        
                        {/* Text lines */}
                        <div className="space-y-2">
                            <div className="w-24 h-4 rounded bg-muted animate-pulse" />
                            <div className="w-16 h-3 rounded bg-muted animate-pulse" />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded bg-muted animate-pulse" />
                        <div className="w-24 h-9 rounded bg-muted animate-pulse" />
                    </div>
                </div>
            ))}

            {/* Footer text shimmer */}
            <div className="flex justify-center pt-4">
                <div className="w-48 h-3 rounded bg-muted animate-pulse" />
            </div>
        </div>
    );
}
