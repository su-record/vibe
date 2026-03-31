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

export class ComponentRegistry<T> {
  private readonly entries = new Map<string, ComponentEntry<T>>();

  /** Register a component by name */
  register(
    name: string,
    spec: ComponentSpec<T>,
    metadata?: Record<string, unknown>,
  ): void {
    if (!name) {
      throw new Error('Component name must not be empty');
    }

    const factory = typeof spec === 'function'
      ? spec as () => T
      : (): T => spec;

    this.entries.set(name, {
      name,
      factory,
      metadata: metadata ?? {},
    });
  }

  /** Resolve a component by name (creates instance via factory) */
  resolve(name: string): T {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new Error(`Component not found: ${name}`);
    }
    return entry.factory();
  }

  /** Check if a component is registered */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /** Unregister a component */
  unregister(name: string): boolean {
    return this.entries.delete(name);
  }

  /** List all registered component names */
  list(): string[] {
    return [...this.entries.keys()];
  }

  /** List all entries with metadata */
  listWithMetadata(): ComponentEntry<T>[] {
    return [...this.entries.values()];
  }

  /** Get the number of registered components */
  get size(): number {
    return this.entries.size;
  }

  /** Clear all registrations */
  clear(): void {
    this.entries.clear();
  }
}
