import { Notification } from '@/lib/api';

/**
 * Resolves the navigation path for a notification.
 * 
 * Priority:
 * 1. Deep Link explicit from backend (SSOT)
 * 2. Legacy fallback dependent on type/entity
 * 3. Default to notifications list
 */
export function resolveNotificationNavigation(n: Notification): string {
    // 1. Prioridad: Deep Link explícito del backend
    // 🔴 SECURITY: Validamos que sea una ruta interna segura
    if (n.metadata?.deep_link) {
        const link = n.metadata.deep_link;
        const isInternal = link.startsWith('/') && !link.startsWith('//') && !link.includes('javascript:');
        
        if (isInternal) {
            return link;
        }
        // Si es malicioso o inválido, ignoramos el deep_link y pasamos al fallback
        console.warn('[Notification] Unsafe or invalid deep_link ignored:', link);
    }

    // 2. Fallback: Lógica Legacy (para notificaciones antiguas o sin metadata)
    if (n.report_id) {
        return `/reporte/${n.report_id}`;
    }
    
    if (n.type === 'follow' && n.entity_id) {
        return `/usuario/${n.entity_id}`;
    }
    
    if (n.type === 'achievement') {
        return '/perfil?tab=achievements';
    }

    // 3. Default
    return '/notificaciones';
}
