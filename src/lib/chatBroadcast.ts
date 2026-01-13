/**
 * Chat BroadcastChannel - Multi-Tab Sync (WhatsApp-Grade)
 * 
 * Provides instant 0ms synchronization between browser tabs using
 * the BroadcastChannel API (W3C standard, no external dependencies).
 * 
 * Flow:
 * 1. Tab A sends message → emits to BroadcastChannel
 * 2. Tab B receives instantly → upserts to cache (pending state)
 * 3. SSE arrives later → confirms message (clears localStatus)
 * 
 * This is L0 (fastest) sync. SSE is L1 (authoritative).
 */

import { ChatMessage } from './api';

const CHANNEL_NAME = 'safespot-chat-sync';

// Event types for chat synchronization
export type ChatBroadcastEvent =
    | { type: 'new-message'; roomId: string; message: ChatMessage }
    | { type: 'message-deleted'; roomId: string; messageId: string }
    | { type: 'typing'; roomId: string; senderId: string; isTyping: boolean };

type ChatBroadcastListener = (event: ChatBroadcastEvent) => void;

class ChatBroadcastManager {
    private channel: BroadcastChannel | null = null;
    private listeners = new Set<ChatBroadcastListener>();
    private isInitialized = false;

    constructor() {
        this.init();
    }

    private init() {
        // SSR safety
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
            console.warn('[ChatBroadcast] BroadcastChannel not available');
            return;
        }

        try {
            this.channel = new BroadcastChannel(CHANNEL_NAME);
            this.channel.onmessage = (event: MessageEvent<ChatBroadcastEvent>) => {
                this.notifyListeners(event.data);
            };
            this.isInitialized = true;
            console.log('[ChatBroadcast] ✅ Initialized');
        } catch (err) {
            console.error('[ChatBroadcast] Failed to initialize:', err);
        }
    }

    /**
     * Emit an event to all other tabs (not self)
     */
    emit(event: ChatBroadcastEvent): void {
        if (!this.channel) return;

        try {
            this.channel.postMessage(event);
            // Note: BroadcastChannel does NOT echo to sender, only other tabs
        } catch (err) {
            console.error('[ChatBroadcast] Failed to emit:', err);
        }
    }

    /**
     * Subscribe to events from other tabs
     * Returns unsubscribe function
     */
    subscribe(listener: ChatBroadcastListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(event: ChatBroadcastEvent) {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (err) {
                console.error('[ChatBroadcast] Error in listener:', err);
            }
        });
    }

    /**
     * Check if BroadcastChannel is available
     */
    isAvailable(): boolean {
        return this.isInitialized;
    }
}

// Singleton instance
export const chatBroadcast = new ChatBroadcastManager();
