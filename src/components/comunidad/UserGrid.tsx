/**
 * 🏛️ SAFE MODE: UserGrid - Layout Responsive Grid/List
 * 
 * Layout que adapta la visualización de usuarios:
 * - Mobile: Lista vertical (como ahora)
 * - Desktop (md+): Grid de 2 columnas
 * - Hover preview con info detallada
 * 
 * @version 2.0 - With Hover Preview
 */

import type { UserProfile } from '@/lib/api';
import { UserCard } from './UserCard';
import { CommunitySkeleton } from './CommunitySkeleton';
import { UserPreview, useUserPreview } from './UserPreview';
import { ReactNode, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface UserGridProps {
    users: UserProfile[];
    loading?: boolean;
    emptyState?: ReactNode;
    showLocation?: boolean;
    className?: string;
}

export function UserGrid({
    users,
    loading = false,
    emptyState,
    showLocation = false,
    className
}: UserGridProps) {
    const { 
        hoveredUser, 
        handleMouseEnter, 
        handleMouseLeave, 
        handleMouseMove 
    } = useUserPreview();
    
    // Memoize preview to prevent unnecessary re-renders
    const previewComponent = useMemo(() => {
        if (!hoveredUser) return null;
        return (
            <UserPreview
                user={hoveredUser.user}
                x={hoveredUser.x}
                y={hoveredUser.y}
                visible={true}
            />
        );
    }, [hoveredUser]);

    if (loading) {
        return <CommunitySkeleton />;
    }

    if (users.length === 0 && emptyState) {
        return <>{emptyState}</>;
    }

    return (
        <>
            <div className={cn(
                "grid gap-4",
                // Mobile: lista de 1 columna (default)
                // Desktop: grid de 2 columnas
                "md:grid-cols-2",
                className
            )}>
                {users.map((user, index) => (
                    <UserCard 
                        key={user.anonymous_id} 
                        user={user} 
                        showLocation={showLocation}
                        // Staggered animation delay
                        style={{ animationDelay: `${index * 50}ms` }}
                        // Hover preview handlers
                        onMouseEnter={handleMouseEnter(user)}
                        onMouseLeave={handleMouseLeave}
                        onMouseMove={handleMouseMove}
                    />
                ))}
            </div>

            {/* Floating Preview */}
            {previewComponent}
        </>
    );
}
