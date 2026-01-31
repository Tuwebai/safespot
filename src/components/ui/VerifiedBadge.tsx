import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
    className?: string;
    size?: number;
}

export function VerifiedBadge({ className = "text-blue-400", size = 14 }: VerifiedBadgeProps) {
    return (
        <BadgeCheck
            className={className}
            size={size}
            strokeWidth={2.5}
        />
    );
}
