/**
 * ComponentRegistry — Generic component registry with flexible resolution
 * Inspired by Agent-Lightning's build_component() pattern.
 *
 * Supports registering components as:
 * - Direct instances
 * - Factory functions
 * - String names (resolved from registry)
 */
export type ComponentSpec<T> = T | (() => T);
export interface ComponentEntry<T> {
    name: string;
    factory: () => T;
    metadata: Record<string, unknown>;
}
export declare class ComponentRegistry<T> {
    private readonly entries;
    /** Register a component by name */
    register(name: string, spec: ComponentSpec<T>, metadata?: Record<string, unknown>): void;
    /** Resolve a component by name (creates instance via factory) */
    resolve(name: string): T;
    /** Check if a component is registered */
    has(name: string): boolean;
    /** Unregister a component */
    unregister(name: string): boolean;
    /** List all registered component names */
    list(): string[];
    /** List all entries with metadata */
    listWithMetadata(): ComponentEntry<T>[];
    /** Get the number of registered components */
    get size(): number;
    /** Clear all registrations */
    clear(): void;
}
//# sourceMappingURL=ComponentRegistry.d.ts.map