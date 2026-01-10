
/**
 * SSE Connection Pool Manager
 * 
 * Prevents hitting the browser's 6-connection limit per domain
 * by sharing EventSource instances across multiple hooks in the same tab.
 * 
 * Features:
 * - Reference counting for connections.
 * - Automatic cleanup when last listener unsubscribes.
 * - Centralized event dispatching.
 */

type SSEListener = (event: MessageEvent) => void;

class SSEPool {
    private connections = new Map<string, {
        source: EventSource,
        refCount: number,
        listeners: Map<string, Set<SSEListener>>
    }>();

    /**
     * Subscribe to an EventSource.
     * If the connection doesn't exist, it's created.
     */
    subscribe(url: string, eventName: string, listener: SSEListener) {
        let entry = this.connections.get(url);

        if (!entry) {
            const source = new EventSource(url);
            entry = {
                source,
                refCount: 0,
                listeners: new Map()
            };
            this.connections.set(url, entry);

            // Handle default 'message' event and error logging
            source.onmessage = (e) => this.dispatch(url, 'message', e);
            source.onerror = (e) => {
                // If closed by server, cleanup will happen on unsubscribe
                // console.warn(`[SSEPool] Error on ${url}`, e);
            };
        }

        entry.refCount++;

        // Ensure the source is listening for this specific event type
        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
            entry.source.addEventListener(eventName, (e) => this.dispatch(url, eventName, e as MessageEvent));
        }

        entry.listeners.get(eventName)!.add(listener);

        // Return unsubscribe function
        return () => this.unsubscribe(url, eventName, listener);
    }

    private unsubscribe(url: string, eventName: string, listener: SSEListener) {
        const entry = this.connections.get(url);
        if (!entry) return;

        const eventListeners = entry.listeners.get(eventName);
        if (eventListeners) {
            eventListeners.delete(listener);
            if (eventListeners.size === 0) {
                entry.listeners.delete(eventName);
                // Note: We don't removeEventListener because it's managed by entry.source
            }
        }

        entry.refCount--;

        if (entry.refCount <= 0) {
            entry.source.close();
            this.connections.delete(url);
            // console.log(`[SSEPool] Closed connection: ${url}`);
        }
    }

    private dispatch(url: string, eventName: string, event: MessageEvent) {
        const entry = this.connections.get(url);
        if (!entry) return;

        const eventListeners = entry.listeners.get(eventName);
        if (eventListeners) {
            eventListeners.forEach(fn => {
                try {
                    fn(event);
                } catch (err) {
                    console.error(`[SSEPool] Error in listener for ${url}/${eventName}:`, err);
                }
            });
        }
    }
}

export const ssePool = new SSEPool();
