import { uuidv7 } from 'uuidv7';
import type { ZodType } from 'zod';
import {
  type AutonomyEventType,
  EventSchemaMap,
  type EventPayload,
  type EventInput,
  type EnrichedEvent,
} from './schemas.js';

const MAX_LISTENERS = 50;
const MAX_DEDUP_CACHE = 1000;

export type EventListener<T extends AutonomyEventType> = (
  event: EnrichedEvent<EventPayload<T>>,
) => void | Promise<void>;

interface ListenerEntry {
  fn: (event: unknown) => void | Promise<void>;
}

export class EventBus {
  private readonly listeners = new Map<string, ListenerEntry[]>();
  private totalListenerCount = 0;
  private readonly dedupCache = new Set<string>();
  private readonly dedupOrder: string[] = [];
  private lastSyncErrors: Error[] = [];

  on<T extends AutonomyEventType>(
    eventType: T,
    listener: EventListener<T>,
  ): void {
    if (this.totalListenerCount >= MAX_LISTENERS) {
      throw new Error(`Maximum listener limit (${MAX_LISTENERS}) reached`);
    }
    const list = this.listeners.get(eventType) || [];
    list.push({ fn: listener as (event: unknown) => void | Promise<void> });
    this.listeners.set(eventType, list);
    this.totalListenerCount++;
  }

  off<T extends AutonomyEventType>(
    eventType: T,
    listener: EventListener<T>,
  ): void {
    const list = this.listeners.get(eventType);
    if (!list) return;
    const idx = list.findIndex(
      (e) => e.fn === (listener as (event: unknown) => void | Promise<void>),
    );
    if (idx !== -1) {
      list.splice(idx, 1);
      this.totalListenerCount--;
    }
  }

  emit<T extends AutonomyEventType>(
    eventType: T,
    payload: EventInput<T>,
  ): EnrichedEvent<EventPayload<T>> {
    const schema = EventSchemaMap[eventType] as ZodType;
    const validated = schema.parse(payload) as Record<string, unknown>;

    const enriched = {
      ...validated,
      correlationId:
        (validated.correlationId as string) || uuidv7(),
      timestamp:
        (validated.timestamp as string) || new Date().toISOString(),
    } as EnrichedEvent<EventPayload<T>>;

    if (eventType !== 'error') {
      this.lastSyncErrors = [];
    }
    this.dispatch(eventType, enriched);
    return enriched;
  }

  emitIdempotent<T extends AutonomyEventType>(
    eventId: string,
    eventType: T,
    payload: EventInput<T>,
  ): EnrichedEvent<EventPayload<T>> | null {
    if (this.dedupCache.has(eventId)) {
      return null;
    }
    const result = this.emit(eventType, payload);
    if (this.lastSyncErrors.length === 0) {
      this.trackDedup(eventId);
    }
    return result;
  }

  getListenerCount(eventType?: AutonomyEventType): number {
    if (eventType) {
      return (this.listeners.get(eventType) || []).length;
    }
    return this.totalListenerCount;
  }

  getLastSyncErrors(): ReadonlyArray<Error> {
    return this.lastSyncErrors;
  }

  removeAllListeners(eventType?: AutonomyEventType): void {
    if (eventType) {
      const list = this.listeners.get(eventType);
      if (list) {
        this.totalListenerCount -= list.length;
        this.listeners.delete(eventType);
      }
    } else {
      this.listeners.clear();
      this.totalListenerCount = 0;
    }
  }

  private dispatch(eventType: string, event: unknown): void {
    const list = this.listeners.get(eventType) || [];
    for (let i = 0; i < list.length; i++) {
      try {
        const result = list[i].fn(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err: unknown) => {
            this.handleListenerError(eventType, i, err);
          });
        }
      } catch (err: unknown) {
        this.lastSyncErrors.push(err instanceof Error ? err : new Error(String(err)));
        this.handleListenerError(eventType, i, err);
      }
    }
  }

  private handleListenerError(
    eventType: string,
    listenerIndex: number,
    err: unknown,
  ): void {
    if (eventType === 'error') {
      process.stderr.write(
        `[EventBus] Error in error listener: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return;
    }
    try {
      this.emit('error', {
        originalEventType: eventType,
        listenerIndex,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    } catch {
      process.stderr.write(
        `[EventBus] Failed to emit error event: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  private trackDedup(eventId: string): void {
    this.dedupCache.add(eventId);
    this.dedupOrder.push(eventId);
    if (this.dedupOrder.length > MAX_DEDUP_CACHE) {
      const oldest = this.dedupOrder.shift()!;
      this.dedupCache.delete(oldest);
    }
  }
}
