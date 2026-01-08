import { v4 as uuidv4 } from 'uuid';

/**
 * Client ID (Session ID)
 * Uniquely identifies the current browser tab/window for the duration of the page load.
 * Used for Echo Suppression in Real-time events.
 */
let clientId: string | null = null;

export function getClientId(): string {
    if (!clientId) {
        // Try to get from sessionStorage first (survives refreshes in same tab)
        const stored = sessionStorage.getItem('safespot_client_id');
        if (stored) {
            clientId = stored;
        } else {
            clientId = uuidv4();
            sessionStorage.setItem('safespot_client_id', clientId);
        }
    }
    return clientId;
}
