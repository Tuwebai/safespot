import React from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToggleReportLikeMutation } from '@/hooks/queries/useReportsQuery';

interface LikeButtonProps {
    reportId: string;
    isLiked?: boolean;
    likesCount?: number;
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
    likesCount = 0,
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
                "gap-2 transition-all duration-300 group active:scale-95",
                isLiked
                    ? "text-neon-blue bg-neon-blue/10 hover:bg-neon-blue/20 border-neon-blue/30"
                    : "text-muted-foreground hover:text-neon-blue hover:bg-neon-blue/5",
                className
            )}
        >
            <motion.div
                whileTap={{ scale: 1.4 }}
                className="relative"
            >
                <ThumbsUp
                    size={18}
                    className={cn(
                        "transition-transform duration-300",
                        isLiked ? "fill-current" : "group-hover:scale-110"
                    )}
                />

                <AnimatePresence>
                    {isLiked && (
                        <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 bg-neon-blue rounded-full"
                        />
                    )}
                </AnimatePresence>
            </motion.div>

            {showCount && (
                <span className={cn(
                    "text-sm font-medium tabular-nums transition-colors",
                    isLiked ? "text-neon-blue" : "text-muted-foreground"
                )}>
                    {likesCount}
                </span>
            )}
        </Button>
    );
}
