export type CircuitState = 'closed' | 'open' | 'half-open';
export declare class CircuitBreaker {
    private state;
    private failures;
    private lastOpenedAt;
    /**
     * Check if generation is allowed
     */
    canExecute(): boolean;
    /**
     * Record a generation result
     */
    record(success: boolean): void;
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Force reset to closed state
     */
    reset(): void;
    /**
     * Get failure stats
     */
    getStats(): {
        state: CircuitState;
        recentFailures: number;
        windowSize: number;
    };
}
//# sourceMappingURL=CircuitBreaker.d.ts.map