import React from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToggleReportLikeMutation } from '@/hooks/queries/useReportsQuery';

interface LikeButtonProps {
    reportId: string;
    isLiked?: boolean;
    upvotesCount?: number;
    className?: string;
    variant?: 'ghost' | 'outline' | 'default';
    showCount?: boolean;
}

/**
 * 🛰️ SafeSpot Social Action: LikeButton
 * Separated from FavoriteButton as per Enterprise Audit (Feb 2026).
 * Public signal that impacts Feed Ranking.
 */
export function LikeButton({
    reportId,
    isLiked = false,
    upvotesCount = 0,
    className,
    variant = 'ghost',
    showCount = true
}: LikeButtonProps) {
    const { mutate: toggleLike, isPending } = useToggleReportLikeMutation();

    const handleLike = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLike({ reportId, liked: !isLiked });
    };

    return (
        <Button
            variant={variant}
            size="sm"
            disabled={isPending}
            onClick={handleLike}
            className={cn(
                "gap-2 transition-all duration-300 group active:scale-95 px-3 py-1.5 h-auto rounded-full border",
                isLiked
                    ? "bg-sky-500/20 text-sky-400 border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                    : "bg-white/5 text-slate-300 border-white/10 hover:border-sky-400/50 hover:bg-sky-400/10 hover:text-sky-400",
                className
            )}
        >
            <motion.div
                whileTap={{ scale: 1.4 }}
                className="relative flex items-center justify-center"
            >
                <ThumbsUp
                    size={16}
                    strokeWidth={2.5}
                    className={cn(
                        "transition-all duration-300",
                        isLiked ? "fill-sky-400 filter drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]" : "group-hover:scale-110"
                    )}
                />

                <AnimatePresence>
                    {isLiked && (
                        <motion.span
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 2.2, opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="absolute inset-0 bg-sky-400 rounded-full"
                        />
                    )}
                </AnimatePresence>
            </motion.div>

            {showCount && (
                <span className={cn(
                    "text-[0.95rem] font-bold tabular-nums tracking-tight transition-colors drop-shadow-sm",
                    isLiked ? "text-sky-300" : "text-slate-200"
                )}>
                    {upvotesCount}
                </span>
            )}
        </Button>
    );
}
