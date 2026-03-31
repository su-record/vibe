import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentRegistry } from '../ComponentRegistry.js';

interface MockService {
  name: string;
  execute(): string;
}

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry<MockService>;

  beforeEach(() => {
    registry = new ComponentRegistry<MockService>();
  });

  describe('register + resolve', () => {
    it('should register and resolve a direct instance', () => {
      const service: MockService = { name: 'svc1', execute: () => 'result1' };
      registry.register('svc1', service);

      const resolved = registry.resolve('svc1');
      expect(resolved.name).toBe('svc1');
      expect(resolved.execute()).toBe('result1');
    });

    it('should register and resolve a factory function', () => {
      let callCount = 0;
      registry.register('svc2', () => {
        const id = ++callCount;
        return { name: 'svc2', execute: () => `result-${id}` };
      });

      const r1 = registry.resolve('svc2');
      const r2 = registry.resolve('svc2');
      expect(r1.execute()).toBe('result-1');
      expect(r2.execute()).toBe('result-2');
      expect(callCount).toBe(2);
    });

    it('should throw on resolving unregistered name', () => {
      expect(() => registry.resolve('missing')).toThrow('Component not found: missing');
    });

    it('should throw on empty name', () => {
      const service: MockService = { name: 'x', execute: () => 'x' };
      expect(() => registry.register('', service)).toThrow('Component name must not be empty');
    });
  });

  describe('has', () => {
    it('should return true for registered component', () => {
      registry.register('exists', { name: 'e', execute: () => 'e' });
      expect(registry.has('exists')).toBe(true);
    });

    it('should return false for unregistered component', () => {
      expect(registry.has('nope')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should remove a registered component', () => {
      registry.register('temp', { name: 't', execute: () => 't' });
      expect(registry.unregister('temp')).toBe(true);
      expect(registry.has('temp')).toBe(false);
    });

    it('should return false for unregistered name', () => {
      expect(registry.unregister('nope')).toBe(false);
    });
  });

  describe('list + listWithMetadata', () => {
    it('should list registered names', () => {
      registry.register('a', { name: 'a', execute: () => 'a' });
      registry.register('b', { name: 'b', execute: () => 'b' });
      expect(registry.list()).toEqual(['a', 'b']);
    });

    it('should list entries with metadata', () => {
      registry.register('svc', { name: 's', execute: () => 's' }, { version: '1.0' });
      const entries = registry.listWithMetadata();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('svc');
      expect(entries[0].metadata).toEqual({ version: '1.0' });
    });
  });

  describe('size + clear', () => {
    it('should report correct size', () => {
      expect(registry.size).toBe(0);
      registry.register('a', { name: 'a', execute: () => 'a' });
      expect(registry.size).toBe(1);
    });

    it('should clear all entries', () => {
      registry.register('a', { name: 'a', execute: () => 'a' });
      registry.register('b', { name: 'b', execute: () => 'b' });
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });

  describe('metadata defaults', () => {
    it('should default metadata to empty object', () => {
      registry.register('svc', { name: 's', execute: () => 's' });
      const entries = registry.listWithMetadata();
      expect(entries[0].metadata).toEqual({});
    });
  });

  describe('overwrite registration', () => {
    it('should allow re-registering same name', () => {
      registry.register('svc', { name: 'v1', execute: () => 'v1' });
      registry.register('svc', { name: 'v2', execute: () => 'v2' });
      expect(registry.resolve('svc').name).toBe('v2');
      expect(registry.size).toBe(1);
    });
  });
});
