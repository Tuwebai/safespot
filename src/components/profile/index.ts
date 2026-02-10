/**
 * 🏛️ SAFE MODE: Profile Components Barrel Export
 * 
 * Todos los componentes de perfil se exportan desde aquí.
 * NO importar desde rutas profundas.
 */

export { ProfileHeader } from './ProfileHeader';
export type { ProfileHeaderProps } from './ProfileHeader';

export { ReportList } from './ReportList';
export type { ReportListProps } from './ReportList';

export { StatsCards } from './StatsCards';
export type { StatsCardsProps } from './StatsCards';

export { BadgesGrid } from './BadgesGrid';
export type { BadgesGridProps, Badge } from './BadgesGrid';

export { NextBadgeCard } from './NextBadgeCard';
export type { NextBadgeCardProps, NextBadge } from './NextBadgeCard';

export { ActivityTimeline } from './ActivityTimeline';
export type { ActivityTimelineProps } from './ActivityTimeline';

// Re-exportar componentes existentes para consistencia
export { EditAliasModal } from './EditAliasModal';
export { TrustHub } from './TrustHub';
