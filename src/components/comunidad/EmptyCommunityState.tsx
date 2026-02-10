import { Users, MapPin } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { useNavigate } from 'react-router-dom';

interface EmptyCommunityStateProps {
    type: 'nearby' | 'global';
    locality?: string | null;
    isLocationMissing?: boolean;
}

export function EmptyCommunityState({ type, locality, isLocationMissing }: EmptyCommunityStateProps) {
    const { success, error } = useToast();
    const navigate = useNavigate();

    const handleCopyLink = () => {
        const url = "https://safespot.tuweb-ai.com";
        navigator.clipboard.writeText(url)
            .then(() => success('Link copiado al portapapeles'))
            .catch(() => error('No se pudo copiar el link'));
    };

    const handleConfigureLocation = () => {
        navigate('/ajustes');
    };

    if (type === 'nearby' && isLocationMissing) {
        return (
            <EmptyState
                variant="permission"
                icon={MapPin}
                title="Para ver personas cerca, actualizá tu ubicación"
                description="Configurá tu zona de alertas para encontrar usuarios en tu ciudad y recibir reportes relevantes."
                action={{
                    label: "Configurar Ubicación",
                    onClick: handleConfigureLocation,
                }}
                className="py-12"
            />
        );
    }

    return (
        <EmptyState
            variant="community"
            icon={Users}
            title={type === 'nearby'
                ? (locality ? `No hay personas en ${locality}` : 'Todavía no hay personas cerca tuyo')
                : 'Aún no hay usuarios en la comunidad'}
            description={type === 'nearby'
                ? 'Compartí SafeSpot para que más personas de tu ciudad se sumen a la comunidad y se cuiden entre sí.'
                : 'Sé el primero en invitar a tus amigos a unirse a SafeSpot.'}
            action={{
                label: "Copiar link para compartir",
                onClick: handleCopyLink,
                variant: "neon"
            }}
            className="py-12"
        />
    );
}
