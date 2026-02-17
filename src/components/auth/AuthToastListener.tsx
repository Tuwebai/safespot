
import { useEffect } from 'react';
import { useToast } from '@/components/ui/toast/useToast';

/**
 * Listens for flags in localStorage set before a hard reload (Login/Logout)
 * and displays the appropriate Toast feedback to the user.
 */
export function AuthToastListener() {
    const { success, info } = useToast();

    useEffect(() => {
        const url = new URL(window.location.href);
        const reasonParam = url.searchParams.get('reason');
        const storedReason = localStorage.getItem('safespot_auth_logout_reason');
        const normalizedReason = reasonParam === 'session-expired'
            ? 'SESSION_EXPIRED'
            : storedReason;

        // 1. Check for Login/Swap Success
        const swapped = localStorage.getItem('safespot_auth_swapped');
        if (swapped) {
            localStorage.removeItem('safespot_auth_swapped');
            success("Sesión restaurada: Tu progreso anónimo se ha fusionado con tu cuenta.");
        }

        // 2. Check for Logout Success
        const logout = localStorage.getItem('safespot_auth_logout');
        if (normalizedReason === 'SESSION_EXPIRED') {
            localStorage.removeItem('safespot_auth_logout');
            localStorage.removeItem('safespot_auth_logout_reason');
            info("Sesión expirada. Iniciá sesión de nuevo");

            if (reasonParam === 'session-expired') {
                url.searchParams.delete('reason');
                window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
            }
        } else if (logout) {
            localStorage.removeItem('safespot_auth_logout');
            localStorage.removeItem('safespot_auth_logout_reason');
            info("Modo Invitado Activo: Cerraste sesión, pero sigues navegando seguro.");
        }
    }, [success, info]);

    return null; // Logic only component
}
