/**
 * 🏛️ SAFE MODE: NotificationsSection - Configuración de Notificaciones
 * 
 * Fase 3 Polish: Layout grid para evitar scroll infinito
 * 
 * @version 1.1 - Layout responsive grid
 */

import { NotificationSettingsSection } from '@/components/NotificationSettingsSection';
import { AlertZoneStatusSection } from '@/components/AlertZoneStatusSection';

export function NotificationsSection() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AlertZone ocupa columna completa en mobile, mitad en desktop */}
            <div className="lg:col-span-2">
                <AlertZoneStatusSection />
            </div>
            
            {/* Location y Notificaciones lado a lado en desktop */}
            <div className="lg:col-span-2">
                <NotificationSettingsSection />
            </div>
        </div>
    );
}
