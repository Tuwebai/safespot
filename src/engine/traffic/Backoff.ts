/**
 * Generalized Exponential Backoff with Jitter
 * Enterprise Grade Utility (Motor 7)
 */
export class Backoff {
    private attempt = 0;
    private maxDelay: number;
    private baseDelay: number;

    constructor(baseDelay = 1000, maxDelay = 60000) {
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
    }

    getDelay() {
        const exponential = this.baseDelay * Math.pow(2, this.attempt);
        const cap = Math.min(exponential, this.maxDelay);
        this.attempt++;

        // Jitter: Add ±25% randomness to avoid synchronized thundering herd
        const jitter = (Math.random() * 0.5 - 0.25) * cap;
        return Math.floor(cap + jitter);
    }

    reset() {
        this.attempt = 0;
    }

    setAttempt(count: number) {
        this.attempt = count;
    }

    get count() {
        return this.attempt;
    }
}
