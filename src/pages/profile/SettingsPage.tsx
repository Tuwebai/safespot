/**
 * 🏛️ SAFE MODE: SettingsPage - Página de Ajustes con Sidebar
 * 
 * Fase 2 del refactor enterprise: Nueva página de settings con layout sidebar.
 * Reemplaza la versión anterior con tabs.
 * 
 * @version 1.0 - Layout sidebar
 */

import { useState } from 'react';
import {
    Bell,
    Palette,
    Map as MapIcon,
    Shield,
    Database
} from 'lucide-react';
import { 
    SettingsLayout, 
    NotificationsSection, 
    AppearanceSection,
    MapSettingsSection,
    PrivacySection,
    DataSection
} from '@/components/settings';

const navItems = [
    { id: 'notifications', label: 'Alertas', icon: <Bell className="w-4 h-4" /> },
    { id: 'appearance', label: 'Apariencia', icon: <Palette className="w-4 h-4" /> },
    { id: 'map', label: 'Mapa', icon: <MapIcon className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacidad', icon: <Shield className="w-4 h-4" /> },
    { id: 'data', label: 'Datos', icon: <Database className="w-4 h-4" /> },
];

export function SettingsPage() {
    const [activeSection, setActiveSection] = useState('notifications');

    const renderSection = () => {
        switch (activeSection) {
            case 'notifications':
                return <NotificationsSection />;
            case 'appearance':
                return <AppearanceSection />;
            case 'map':
                return <MapSettingsSection />;
            case 'privacy':
                return <PrivacySection />;
            case 'data':
                return <DataSection />;
            default:
                return <NotificationsSection />;
        }
    };

    return (
        <SettingsLayout
            title="Configuración"
            navItems={navItems}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
        >
            {renderSection()}
        </SettingsLayout>
    );
}
