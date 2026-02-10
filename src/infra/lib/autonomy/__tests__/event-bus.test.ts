import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../EventBus.js';
import { AgentActionEventSchema } from '../schemas.js';
import type { EnrichedEvent, AgentActionEvent } from '../schemas.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // Scenario 1: typed 이벤트 발행/구독 + correlationId 자동 주입
  describe('Scenario 1: 이벤트 발행/구독', () => {
    it('should emit typed event and deliver to listener', () => {
      const received: EnrichedEvent<AgentActionEvent>[] = [];
      bus.on('agent_action', (event) => {
        received.push(event);
      });

      bus.emit('agent_action', {
        agentId: 'implementer',
        actionType: 'file_write',
        target: '/tmp/test.ts',
      });

      expect(received).toHaveLength(1);
      expect(received[0].agentId).toBe('implementer');
      expect(received[0].actionType).toBe('file_write');
    });

    it('should auto-inject correlationId in UUIDv7 format', () => {
      let captured: EnrichedEvent<AgentActionEvent> | null = null;
      bus.on('agent_action', (event) => {
        captured = event;
      });

      bus.emit('agent_action', {
        agentId: 'test',
        actionType: 'bash_exec',
        target: 'echo hello',
      });

      expect(captured).not.toBeNull();
      expect(captured!.correlationId).toBeDefined();
      expect(captured!.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should auto-inject timestamp', () => {
      let captured: EnrichedEvent<AgentActionEvent> | null = null;
      bus.on('agent_action', (event) => {
        captured = event;
      });

      const before = new Date().toISOString();
      bus.emit('agent_action', {
        agentId: 'test',
        actionType: 'file_write',
        target: '/tmp/test',
      });
      const after = new Date().toISOString();

      expect(captured!.timestamp).toBeDefined();
      expect(captured!.timestamp >= before).toBe(true);
      expect(captured!.timestamp <= after).toBe(true);
    });

    it('should preserve provided correlationId', () => {
      let captured: EnrichedEvent<AgentActionEvent> | null = null;
      bus.on('agent_action', (event) => {
        captured = event;
      });

      bus.emit('agent_action', {
        correlationId: 'custom-id-123',
        agentId: 'test',
        actionType: 'file_write',
        target: '/tmp/test',
      });

      expect(captured!.correlationId).toBe('custom-id-123');
    });

    it('should support multiple listeners', () => {
      const results: number[] = [];
      bus.on('agent_action', () => { results.push(1); });
      bus.on('agent_action', () => { results.push(2); });

      bus.emit('agent_action', {
        agentId: 'test',
        actionType: 'file_write',
        target: '/tmp/test',
      });

      expect(results).toEqual([1, 2]);
    });

    it('should support off() to remove listener', () => {
      const results: number[] = [];
      const listener = (): void => {
        results.push(1);
      };
      bus.on('agent_action', listener);
      bus.off('agent_action', listener);

      bus.emit('agent_action', {
        agentId: 'test',
        actionType: 'file_write',
        target: '/tmp/test',
      });

      expect(results).toEqual([]);
    });
  });

  // Scenario 2: Zod 스키마 검증
  describe('Scenario 2: Zod 스키마 검증', () => {
    it('should reject event with missing required fields', () => {
      bus.on('agent_action', () => {});

      expect(() => {
        bus.emit('agent_action', {
          agentId: 'test',
          // actionType missing
          target: '/tmp/test',
        } as AgentActionEvent);
      }).toThrow();
    });

    it('should reject event with invalid actionType', () => {
      expect(() => {
        bus.emit('agent_action', {
          agentId: 'test',
          actionType: 'invalid_type' as AgentActionEvent['actionType'],
          target: '/tmp/test',
        });
      }).toThrow();
    });

    it('should not deliver invalid events to listeners', () => {
      const received: unknown[] = [];
      bus.on('agent_action', (event) => { received.push(event); });

      try {
        bus.emit('agent_action', {} as AgentActionEvent);
      } catch {
        // expected
      }

      expect(received).toHaveLength(0);
    });

    it('should validate nested schemas (PolicyCheckEvent)', () => {
      let captured: unknown = null;
      bus.on('policy_check', (event) => {
        captured = event;
      });

      bus.emit('policy_check', {
        actionEvent: {
          agentId: 'test',
          actionType: 'file_write',
          target: '/tmp/test',
        },
        policies: ['no-delete'],
        result: 'allowed',
        duration: 5,
      });

      expect(captured).not.toBeNull();
    });
  });

  // Error isolation
  describe('Error isolation', () => {
    it('should isolate listener errors and continue dispatching', () => {
      const results: number[] = [];

      bus.on('agent_action', () => {
        throw new Error('Listener 1 failed');
      });
      bus.on('agent_action', () => {
        results.push(2);
      });
      bus.on('error', () => {}); // consume error events

      bus.emit('agent_action', {
        agentId: 'test',
        actionType: 'file_write',
        target: '/tmp/test',
      });

      expect(results).toEqual([2]);
    });

    it('should emit error event when listener fails', () => {
      const errors: unknown[] = [];

      bus.on('agent_action', () => {
        throw new Error('Boom');
      });
      bus.on('error', (event) => { errors.push(event); });

      bus.emit('agent_action', {
        agentId: 'test',
        actionType: 'file_write',
        target: '/tmp/test',
      });

      expect(errors).toHaveLength(1);
    });

    it('should handle async listener errors', async () => {
      const errors: unknown[] = [];

      bus.on('agent_action', async () => {
        throw new Error('Async boom');
      });
      bus.on('error', (event) => { errors.push(event); });

      bus.emit('agent_action', {
        agentId: 'test',
        actionType: 'file_write',
        target: '/tmp/test',
      });

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(errors).toHaveLength(1);
    });
  });

  // Max listeners
  describe('Max listeners', () => {
    it('should throw when exceeding 50 listeners', () => {
      for (let i = 0; i < 50; i++) {
        bus.on('agent_action', () => {});
      }

      expect(() => {
        bus.on('agent_action', () => {});
      }).toThrow(/Maximum listener limit/);
    });

    it('should count listeners correctly', () => {
      bus.on('agent_action', () => {});
      bus.on('policy_check', () => {});

      expect(bus.getListenerCount()).toBe(2);
      expect(bus.getListenerCount('agent_action')).toBe(1);
    });
  });

  // Idempotent emit
  describe('Idempotent emit', () => {
    it('should deduplicate events by eventId', () => {
      const received: unknown[] = [];
      bus.on('agent_action', (event) => { received.push(event); });

      const payload = {
        agentId: 'test',
        actionType: 'file_write' as const,
        target: '/tmp/test',
      };

      const result1 = bus.emitIdempotent('event-1', 'agent_action', payload);
      const result2 = bus.emitIdempotent('event-1', 'agent_action', payload);

      expect(result1).not.toBeNull();
      expect(result2).toBeNull();
      expect(received).toHaveLength(1);
    });
  });
});
