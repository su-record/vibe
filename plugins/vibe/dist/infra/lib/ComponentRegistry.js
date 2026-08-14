/**
 * ComponentRegistry — Generic component registry with flexible resolution
 * Inspired by Agent-Lightning's build_component() pattern.
 *
 * Supports registering components as:
 * - Direct instances
 * - Factory functions
 * - String names (resolved from registry)
 */
export class ComponentRegistry {
    entries = new Map();
    /** Register a component by name */
    register(name, spec, metadata) {
        if (!name) {
            throw new Error('Component name must not be empty');
        }
        const factory = typeof spec === 'function'
            ? spec
            : () => spec;
        this.entries.set(name, {
            name,
            factory,
            metadata: metadata ?? {},
        });
    }
    /** Resolve a component by name (creates instance via factory) */
    resolve(name) {
        const entry = this.entries.get(name);
        if (!entry) {
            throw new Error(`Component not found: ${name}`);
        }
        return entry.factory();
    }
    /** Check if a component is registered */
    has(name) {
        return this.entries.has(name);
    }
    /** Unregister a component */
    unregister(name) {
        return this.entries.delete(name);
    }
    /** List all registered component names */
    list() {
        return [...this.entries.keys()];
    }
    /** List all entries with metadata */
    listWithMetadata() {
        return [...this.entries.values()];
    }
    /** Get the number of registered components */
    get size() {
        return this.entries.size;
    }
    /** Clear all registrations */
    clear() {
        this.entries.clear();
    }
}
//# sourceMappingURL=ComponentRegistry.js.map