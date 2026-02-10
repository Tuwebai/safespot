/**
 * 🏛️ SAFE MODE: Comunidad Components - Barrel Export
 * 
 * Export centralizado de componentes de comunidad.
 * Facilita imports y mantiene consistencia.
 * 
 * @version 2.0 - With Badges & Hover Preview
 */

// Componentes principales
export { CommunityHeader } from './CommunityHeader';
export { CommunityTabs } from './CommunityTabs';
export { CommunitySearch } from './CommunitySearch';
export { UserGrid } from './UserGrid';
export { UserCard } from './UserCard';

// Estados y loading
export { EmptyCommunityState } from './EmptyCommunityState';
export { CommunitySkeleton } from './CommunitySkeleton';
export { CommunityErrorBoundary } from './CommunityErrorBoundary';

// Badges & Preview
export { UserBadges, UserBadge } from './UserBadges';
export { UserPreview, useUserPreview } from './UserPreview';

// Types re-exportados
export type { EmptyStateVariant } from './EmptyCommunityState';
export type { BadgeType } from './UserBadges';

/**
 * 📋 CATÁLOGO DE BADGES FUTUROS (No implementados)
 * 
 * Badges que podrían agregarse según necesidad de producto:
 * 
 * 🏆 CONTRIBUCIÓN:
 * - 'reporter_pro': 10+ reportes verificados
 * - 'investigator': Reportes con evidencia fotográfica
 * - 'early_adopter': Usuario desde antes de v2.0
 * 
 * 👥 SOCIAL:
 * - 'helper': 50+ respuestas útiles en comentarios  
 * - 'connector': 20+ seguidores
 * - 'networker': Sigue a 20+ usuarios
 * 
 * 🎯 ENGAGEMENT:
 * - 'daily_user': Activo 7 días consecutivos
 * - 'night_owl': Activo entre 00:00-06:00
 * - 'weekend_warrior': Solo activo fines de semana
 * 
 * 🛡️ TRUST & SAFETY:
 * - 'trusted': Trust score > 80
 * - 'verified_local': Verificado en zona específica
 * - 'moderator_helper': Reportes que ayudaron a moderar
 * 
 * 🎉 EVENTOS:
 * - 'founder': Primeros 100 usuarios
 * - 'anniversary_1year': Un año en la plataforma
 * - 'beta_tester': Participó en beta cerrada
 * 
 * Implementación futura: Extender BADGE_CONFIG en UserBadges.tsx
 */
