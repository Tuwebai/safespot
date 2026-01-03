/**
 * Standardized Server-Sent Events (SSE) Response Utility
 * 
 * Encapsulates the SSE protocol details to ensure consistent, robust, 
 * and professional real-time streaming across the application.
 * 
 * Features:
 * - Proper Header Management
 * - Connection Stabilization (Initial Padding) for Proxies/Browsers
 * - Structured Event Formatting
 * - Automatic Keep-Alive (Heartbeats)
 */
export class SSEResponse {
    /**
     * Initialize an SSE connection
     * @param {import('express').Response} res - Express response object
     */
    constructor(res) {
        this.res = res;
        this.heartbeatInterval = null;
        this.init();
    }

    /**
     * Sets up the necessary HTTP headers and sends initial stabilization data
     */
    init() {
        // Essential: Disable default Node.js timeout for this connection
        this.res.socket?.setTimeout(0);
        this.res.socket?.setKeepAlive(true);

        // Standard SSE Headers
        this.res.statusCode = 200;
        this.res.setHeader('Content-Type', 'text/event-stream');
        this.res.setHeader('Cache-Control', 'no-cache, no-transform'); // no-transform prevents proxy compression
        this.res.setHeader('Connection', 'keep-alive');

        // Nginx/Proxy specific: Disable buffering to ensure real-time delivery
        this.res.setHeader('X-Accel-Buffering', 'no');
        this.res.setHeader('X-Content-Type-Options', 'nosniff'); // Security + Browser compatibility

        // Ensure headers are sent immediately
        if (typeof this.res.flushHeaders === 'function') {
            this.res.flushHeaders();
        }

        // Connection Stabilization:
        // Browsers (like Chrome/Brave) and Proxies often buffer the first chunk of data.
        // We send 2KB of whitespace ("padding") to force the buffer to flush immediately.
        // This ensures the generic 'open' event fires on the client side without delay.
        const stabilizationPadding = ':' + ' '.repeat(2048) + '\n\n';
        if (this.res.writable) {
            this.res.write(stabilizationPadding);
        }

        if (typeof this.res.flush === 'function') {
            this.res.flush();
        }
    }

    /**
     * Send a structured event to the client
     * @param {string} type - Event type identifier
     * @param {object} data - Data payload (will be JSON stringified)
     */
    send(type, data) {
        if (!this.res.writable) return;

        try {
            const formattedData = JSON.stringify({ type, ...data });
            this.res.write(`event: message\n`); // Explicit event type helps some listeners
            this.res.write(`data: ${formattedData}\n\n`);

            if (typeof this.res.flush === 'function') {
                this.res.flush();
            }
        } catch (error) {
            console.error('[SSE] Error sending data:', error);
            this.cleanup();
        }
    }

    /**
     * Start the keep-alive heartbeat
     * @param {number} intervalMs - Interval in milliseconds (Default: 5s)
     */
    startHeartbeat(intervalMs = 5000) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        this.heartbeatInterval = setInterval(() => {
            if (!this.res.writable) {
                this.cleanup();
                return;
            }

            // Comment lines starting with ':' are ignored by the EventSource client
            // but keep the TCP connection active.
            this.res.write(`: heartbeat ${new Date().toISOString()}\n\n`);

            if (typeof this.res.flush === 'function') {
                this.res.flush();
            }
        }, intervalMs);
    }

    /**
     * Clean up resources (stop heartbeat)
     * Should be called when client disconnects
     */
    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
}
