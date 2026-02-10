/**
 * 🧹 Botón de emergencia para limpiar cache de usuarios
 * Útil después de limpieza masiva de usuarios test
 */

import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/components/ui/toast';
import { Trash2 } from 'lucide-react';

export function ClearUsersCacheButton() {
    const { success } = useToast();

    const handleClear = () => {
        // Invalidar todas las queries de usuarios
        queryClient.removeQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        
        success('Cache limpiado. Recarga la página para ver cambios.');
        
        // Force reload después de 1 segundo
        setTimeout(() => window.location.reload(), 1000);
    };

    return (
        <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClear}
            className="text-xs"
        >
            <Trash2 className="w-3 h-3 mr-1" />
            Limpiar cache
        </Button>
    );
}
