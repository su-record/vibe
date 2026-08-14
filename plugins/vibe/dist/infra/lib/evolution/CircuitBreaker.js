// Circuit Breaker for self-evolution Phase 4
// Protects generation pipeline from cascading failures
const FAILURE_THRESHOLD = 0.5; // 50%
const WINDOW_SIZE = 10;
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
export class CircuitBreaker {
    state = 'closed';
    failures = []; // true = failure, false = success
    lastOpenedAt = 0;
    /**
     * Check if generation is allowed
     */
    canExecute() {
        if (this.state === 'closed')
            return true;
        if (this.state === 'open') {
            // Check if cooldown period has passed
            if (Date.now() - this.lastOpenedAt >= COOLDOWN_MS) {
                this.state = 'half-open';
                return true; // Allow one trial
            }
            return false;
        }
        // half-open: allow one trial
        return true;
    }
    /**
     * Record a generation result
     */
    record(success) {
        if (this.state === 'half-open') {
            if (success) {
                this.state = 'closed';
                this.failures = [];
            }
            else {
                this.state = 'open';
                this.lastOpenedAt = Date.now();
            }
            return;
        }
        this.failures.push(!success);
        if (this.failures.length > WINDOW_SIZE) {
            this.failures.shift();
        }
        // Check failure rate
        if (this.failures.length >= WINDOW_SIZE) {
            const failureCount = this.failures.filter(f => f).length;
            const failureRate = failureCount / this.failures.length;
            if (failureRate > FAILURE_THRESHOLD) {
                this.state = 'open';
                this.lastOpenedAt = Date.now();
                process.stderr.write(`[Evolution] Circuit breaker OPEN: failure rate ${(failureRate * 100).toFixed(0)}%\n`);
            }
        }
    }
    /**
     * Get current state
     */
    getState() {
        // Auto-transition from open to half-open if cooldown passed
        if (this.state === 'open' && Date.now() - this.lastOpenedAt >= COOLDOWN_MS) {
            this.state = 'half-open';
        }
        return this.state;
    }
    /**
     * Force reset to closed state
     */
    reset() {
        this.state = 'closed';
        this.failures = [];
        this.lastOpenedAt = 0;
    }
    /**
     * Get failure stats
     */
    getStats() {
        return {
            state: this.getState(),
            recentFailures: this.failures.filter(f => f).length,
            windowSize: this.failures.length,
        };
    }
}
//# sourceMappingURL=CircuitBreaker.js.map