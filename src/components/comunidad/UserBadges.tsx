/**
 * 🏛️ SAFE MODE: UserBadges - Sistema de Badges Enterprise
 * 
 * Badges contextuales para usuarios de la comunidad.
 * Diseño profesional, no intrusivo.
 * 
 * @version 1.0 - Enterprise Badge System
 */

import { differenceInDays } from 'date-fns';
import { Sparkles, Shield, Star, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeType = 'new_user' | 'verified' | 'top_contributor' | 'rising_star' | 'legendary';

interface BadgeConfig {
    icon: React.ElementType;
    label: string;
    description: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
}

const BADGE_CONFIG: Record<BadgeType, BadgeConfig> = {
    new_user: {
        icon: Sparkles,
        label: 'Nuevo',
        description: 'Se unió hace menos de 7 días',
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-400',
        borderColor: 'border-blue-500/30'
    },
    verified: {
        icon: Shield,
        label: 'Verificado',
        description: 'Cuenta verificada por SafeSpot',
        bgColor: 'bg-emerald-500/10',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30'
    },
    top_contributor: {
        icon: Star,
        label: 'Top',
        description: 'Mayor contribuidor del mes',
        bgColor: 'bg-amber-500/10',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/30'
    },
    rising_star: {
        icon: TrendingUp,
        label: 'Rising',
        description: 'Crecimiento rápido en la comunidad',
        bgColor: 'bg-purple-500/10',
        textColor: 'text-purple-400',
        borderColor: 'border-purple-500/30'
    },
    legendary: {
        icon: Award,
        label: 'Legend',
        description: 'Miembro fundador con contribuciones excepcionales',
        bgColor: 'bg-rose-500/10',
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/30'
    }
};

interface UserBadgeProps {
    type: BadgeType;
    className?: string;
    showLabel?: boolean;
}

export function UserBadge({ type, className, showLabel = true }: UserBadgeProps) {
    const config = BADGE_CONFIG[type];
    const Icon = config.icon;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                config.bgColor,
                config.textColor,
                config.borderColor,
                className
            )}
            title={config.description}
        >
            <Icon className="w-3 h-3" />
            {showLabel && config.label}
        </span>
    );
}

interface UserBadgesProps {
    createdAt: string;
    isOfficial?: boolean;
    level?: number;
    points?: number;
    className?: string;
}

/**
 * Determina automáticamente los badges del usuario
 */
export function UserBadges({ 
    createdAt, 
    isOfficial, 
    level = 0, 
    points = 0,
    className 
}: UserBadgesProps) {
    const badges: BadgeType[] = [];

    // Badge: Nuevo usuario (últimos 7 días)
    const daysSinceCreated = differenceInDays(new Date(), new Date(createdAt));
    if (daysSinceCreated <= 7) {
        badges.push('new_user');
    }

    // Badge: Verificado
    if (isOfficial) {
        badges.push('verified');
    }

    // Badge: Legendario (nivel 20+)
    if (level >= 20) {
        badges.push('legendary');
    }
    // Badge: Top Contributor (puntos 1000+)
    else if (points >= 1000) {
        badges.push('top_contributor');
    }
    // Badge: Rising Star (nivel 5+ o puntos 200+)
    else if (level >= 5 || points >= 200) {
        badges.push('rising_star');
    }

    if (badges.length === 0) return null;

    return (
        <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
            {badges.map((badge) => (
                <UserBadge key={badge} type={badge} />
            ))}
        </div>
    );
}

// Export para uso individual
export { BADGE_CONFIG };
