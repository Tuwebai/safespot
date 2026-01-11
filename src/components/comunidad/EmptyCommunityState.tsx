import { Button } from '@/components/ui/button';
import { Users, Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface EmptyCommunityStateProps {
    type: 'nearby' | 'global';
}

export function EmptyCommunityState({ type }: EmptyCommunityStateProps) {
    const { success, error } = useToast();

    const handleCopyLink = () => {
        const url = "https://safespot.tuweb-ai.com";
        navigator.clipboard.writeText(url)
            .then(() => success('Link copiado al portapapeles'))
            .catch(() => error('No se pudo copiar el link'));
    };

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-muted-foreground/50" />
            </div>

            <h3 className="text-xl font-semibold mb-2 text-foreground">
                {type === 'nearby'
                    ? 'Todavía no hay personas cerca tuyo'
                    : 'Aún no hay usuarios en la comunidad'}
            </h3>

            <p className="text-muted-foreground max-w-sm mb-8">
                {type === 'nearby'
                    ? 'Compartí SafeSpot para que más personas de tu ciudad se sumen a la comunidad y se cuiden entre sí.'
                    : 'Sé el primero en invitar a tus amigos a unirse a SafeSpot.'}
            </p>

            <Button onClick={handleCopyLink} size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
                <Share2 className="w-4 h-4" />
                Copiar link para compartir
            </Button>
        </div>
    );
}
