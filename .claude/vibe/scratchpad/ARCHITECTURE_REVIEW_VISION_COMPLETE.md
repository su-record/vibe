# Vision Pipeline Architecture Review - Complete Findings

**Review Date:** 2026-02-10
**Files Analyzed:** 6 core files (ScreenCapture.ts, AdaptiveFrameSampler.ts, GeminiLiveStream.ts, VisionSession.ts, src/tools/vision/index.ts, src/cli/commands/vision.ts)
**Total Issues Found:** 17 (P1: 5, P2: 12)

---

## P1: CRITICAL ISSUES (Must Fix)

### 1. GeminiLiveStream.ts:263-267 | Untracked Reconnect Timer Memory Leak

**Severity:** P1 - Critical
**Type:** Resource Leak / Memory Exhaustion

**Location:** `src/vision/GeminiLiveStream.ts:263-267`

**Description:**
The auto-reconnect setTimeout in `handleDisconnect()` is created but never tracked or cleaned up.
- setTimeout ID is not stored in an instance property
- If handleDisconnect fires multiple times (connection churn), timers accumulate in event loop
- If new GeminiLiveStream created while old one reconnecting, both timers fire independently
- Memory leak: Unreferenced timers prevent garbage collection

**Test Case:**
```typescript
const stream = new GeminiLiveStream(apiKey, logger);
await stream.connect();
// Simulate connection loss 3+ times
ws.emit('close');  // First disconnect - timer created (not tracked)
ws.emit('close');  // Second disconnect - another timer created
ws.emit('close');  // Third disconnect - another timer created
// Result: 3 untracked setTimeout callbacks in event loop, none can be cancelled
```

**Current Code:**
```typescript
private handleDisconnect(): void {
  this.clearHeartbeat();
  this.emit({ type: 'disconnected' });

  if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempts];
    this.reconnectAttempts++;
    this.emit({ type: 'reconnecting', attempt: this.reconnectAttempts });
    this.logger('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {  // <-- UNTRACKED! No ID stored
      this.connect(this.model, this.systemInstruction).catch((err) => {
        this.emit({ type: 'error', error: err instanceof Error ? err.message : String(err) });
      });
    }, delay);
  }
  // ...
}
```

**Fix:**
```typescript
private reconnectTimer: NodeJS.Timeout | null = null;

private handleDisconnect(): void {
  this.clearHeartbeat();
  this.emit({ type: 'disconnected' });

  if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempts];
    this.reconnectAttempts++;
    this.emit({ type: 'reconnecting', attempt: this.reconnectAttempts });
    this.logger('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Track new timer
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.model, this.systemInstruction).catch((err) => {
        this.emit({ type: 'error', error: err instanceof Error ? err.message : String(err) });
      });
    }, delay);
  }
}

async disconnect(): Promise<void> {
  this.clearHeartbeat();
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  if (this.ws) {
    this.ws.close();
    this.ws = null;
  }
  this.logger('info', 'GeminiLiveStream disconnected');
}
```

---

### 2. VisionSession.ts:177-185 | Timer Accumulation on Resume

**Severity:** P1 - Critical
**Type:** Resource Leak / Concurrent Operations

**Location:** `src/vision/VisionSession.ts:177-185`

**Description:**
No check for existing timer before creating new one in `startCapturing()`.
- Calling `resume()` → `startCapturing()` multiple times creates duplicate `setInterval` calls
- Each setInterval fires independently = concurrent duplicate captures
- Test: pause() → resume() → pause() → resume() = 2 timers firing simultaneously
- Results in buffer bloat, duplicate frames, memory exhaustion

**Test Case:**
```typescript
const session = mgr.create('user1', engine);
session.start();  // Starts capture timer (Timer A)
session.pause();  // Clears Timer A
session.resume(); // Starts capture timer (Timer B)
session.pause();  // Clears Timer B
session.resume(); // Starts capture timer (Timer C)
// But if pause() doesn't clear properly, Timer B still fires while Timer C fires
// Result: captureOnce() called 2x per 500ms interval
```

**Current Code:**
```typescript
private startCapturing(): void {
  // Capture at ~2 FPS (500ms interval)
  const intervalMs = 500;
  this.captureTimer = setInterval(() => {
    this.captureOnce().catch((err) => {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    });
  }, intervalMs);
}
```

**Issue:** No `clearInterval` before creating new interval.

**Fix:**
```typescript
private startCapturing(): void {
  // Clear any existing capture timer first
  if (this.captureTimer) {
    clearInterval(this.captureTimer);
    this.captureTimer = null;
  }

  const intervalMs = 500;
  this.captureTimer = setInterval(() => {
    this.captureOnce().catch((err) => {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    });
  }, intervalMs);
}
```

---

### 3. VisionSession.ts:88-92 | maxDurationTimer Not Paused

**Severity:** P1 - Critical
**Type:** State Machine Violation

**Location:** `src/vision/VisionSession.ts:88-92` (pause method) and `218-226` (setupTimers)

**Description:**
`pause()` doesn't clear `maxDurationTimer`. Timer continues firing during paused state.
- Users expect `pause()` to suspend all session activity
- If session paused for 1+ minutes, `maxDurationTimer` silently ends session
- Users can't pause → resume indefinitely (contract violation)
- Session ends unexpectedly while user is paused

**Test Case:**
```typescript
const session = mgr.create('user1', engine, {
  maxDurationMs: 5 * 60 * 1000,  // 5 minutes
  inactivityTimeoutMs: 10 * 60 * 1000
});
session.start();
// After 2 min
session.pause();
// Wait 4 minutes while paused (total elapsed = 6 min)
// maxDurationTimer fires even though session is paused!
// session.end('max_duration_exceeded') called
```

**Current Code:**
```typescript
pause(): void {
  if (this.state !== 'capturing' && this.state !== 'streaming') return;
  this.stopCapturing();  // Only clears captureTimer
  this.setState('paused');
  // maxDurationTimer still fires!
}
```

**Fix:**
```typescript
pause(): void {
  if (this.state !== 'capturing' && this.state !== 'streaming') return;
  this.stopCapturing();
  this.clearTimers();  // Clear ALL timers (inactivity + maxDuration)
  this.setState('paused');
}

resume(): void {
  if (this.state !== 'paused') return;
  this.setupTimers();  // Re-setup ALL timers
  this.setState('capturing');
  this.startCapturing();
}
```

---

### 4. src/tools/vision/index.ts:33-44 | Tool Layer Creates Implementation Details

**Severity:** P1 - Critical
**Type:** Architecture Violation / Layer Boundary

**Location:** `src/tools/vision/index.ts:33-44` (ensureEngine function)

**Description:**
Tool layer directly instantiates `LocalCaptureSource` and `CDPCaptureSource`.
- Violates abstraction: ScreenCaptureEngine implementation exposed to tool layer
- If LocalCaptureSource constructor changes, tools/vision breaks
- No dependency injection = multiple engine instances possible
- Singletons (sessionManager, captureEngine, liveStream) in tool layer only
- Different code paths may use different engine instances
- Makes testing difficult (can't mock sources)

**Current Code:**
```typescript
function ensureEngine(): ScreenCaptureEngine {
  if (!captureEngine) {
    const logger = getLogger();
    const sources = [
      new LocalCaptureSource(logger),      // <-- Implementation detail exposed
      new CDPCaptureSource(logger),        // <-- Implementation detail exposed
      new RemoteCaptureSource(),
    ];
    captureEngine = new ScreenCaptureEngine(sources, logger);
  }
  return captureEngine;
}
```

**Fix Option A (Dependency Injection - Preferred):**
```typescript
// In daemon initialization (src/daemon/index.ts or similar)
import { initVisionTools } from './tools/vision/index.js';
import { ScreenCaptureEngine, LocalCaptureSource, CDPCaptureSource, RemoteCaptureSource } from './vision/ScreenCapture.js';

const visionLogger = (level, msg) => console.log(`[vision] ${msg}`);
const sources = [
  new LocalCaptureSource(visionLogger),
  new CDPCaptureSource(visionLogger),
  new RemoteCaptureSource(),
];
const engine = new ScreenCaptureEngine(sources, visionLogger);
initVisionTools(engine);

// In src/tools/vision/index.ts
export function initVisionTools(engine: ScreenCaptureEngine): void {
  captureEngine = engine;
  sessionManager = new VisionSessionManager(getLogger());
}

function ensureEngine(): ScreenCaptureEngine {
  if (!captureEngine) {
    throw new Error('Vision tools not initialized. Call initVisionTools() first.');
  }
  return captureEngine;
}
```

**Fix Option B (Factory Pattern):**
```typescript
type EngineFactory = () => ScreenCaptureEngine;
let engineFactory: EngineFactory | null = null;

export function setEngineFactory(factory: EngineFactory): void {
  engineFactory = factory;
}

function ensureEngine(): ScreenCaptureEngine {
  if (!captureEngine) {
    if (engineFactory) {
      captureEngine = engineFactory();
    } else {
      // Fallback: create default (but log warning)
      console.warn('Using default engine factory. Consider calling setEngineFactory()');
      const logger = getLogger();
      const sources = [
        new LocalCaptureSource(logger),
        new CDPCaptureSource(logger),
        new RemoteCaptureSource(),
      ];
      captureEngine = new ScreenCaptureEngine(sources, logger);
    }
  }
  return captureEngine;
}
```

---

### 5. src/tools/vision/index.ts:341-349 | Missing Shutdown Hook

**Severity:** P1 - Critical
**Type:** Resource Cleanup / Daemon Lifecycle

**Location:** `src/tools/vision/index.ts:341-349`

**Description:**
`shutdownVisionService()` exists but is never called in daemon lifecycle.
- No process.exit trap or shutdown handler
- If daemon restarts or crashes, GeminiLiveStream WebSocket connections leak
- All timers (heartbeat, reconnect, capture, inactivity, maxDuration) leak
- DB resources, file handles accumulate across restarts
- Long-running daemon eventually exhausts resources

**Current Code:**
```typescript
/** 서비스 종료 */
export function shutdownVisionService(): void {
  sessionManager?.endAll();
  if (liveStream) {
    liveStream.disconnect().catch(() => { /* ignore */ });
  }
  captureEngine = null;
  sessionManager = null;
  liveStream = null;
}
```

**Issue:** Function exists but no caller.

**Fix:**
```typescript
// In src/daemon/index.ts or main daemon initialization
import { shutdownVisionService } from './tools/vision/index.js';

// Register shutdown handlers
const shutdownHandlers = [
  shutdownVisionService,
  // ... other shutdown handlers
];

process.on('exit', () => {
  for (const handler of shutdownHandlers) {
    try {
      handler();
    } catch (err) {
      console.error('Shutdown error:', err);
    }
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  for (const handler of shutdownHandlers) {
    try {
      handler();
    } catch (err) {
      console.error('Shutdown error:', err);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  for (const handler of shutdownHandlers) {
    try {
      handler();
    } catch (err) {
      console.error('Shutdown error:', err);
    }
  }
  process.exit(0);
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  for (const handler of shutdownHandlers) {
    try {
      handler();
    } catch (e) {
      console.error('Shutdown error:', e);
    }
  }
  process.exit(1);
});
```

---

## P2: IMPORTANT ISSUES (Should Fix)

### 6. VisionSession.ts:100-108 | Incomplete Listener Cleanup on Session End

**Severity:** P2 - Important
**Type:** Memory Leak / Event Emitter

**Location:** `src/vision/VisionSession.ts:100-108` (end method)

**Description:**
`end()` only resets sampler, doesn't clear event listeners map.
- If session reused via manager, old listeners from previous session still attached
- `VisionSessionManager.create()` replaces session but doesn't force disconnect old listeners
- Old listeners fire events on new session's events
- Slow memory drain in long-running daemon (each ended session leaves listeners behind)

**Current Code:**
```typescript
end(reason: string = 'user_request'): void {
  if (this.state === 'ended') return;
  this.stopCapturing();
  this.clearTimers();
  this.sampler.reset();
  // listeners map never cleared!
  this.setState('ended');
  this.emit('ended', reason);
  this.logger('info', `Vision session ended: ${reason}`);
}
```

**Fix:**
```typescript
end(reason: string = 'user_request'): void {
  if (this.state === 'ended') return;
  this.stopCapturing();
  this.clearTimers();
  this.sampler.reset();
  this.listeners.clear();  // Clear all listeners
  this.setState('ended');
  this.emit('ended', reason);
  this.logger('info', `Vision session ended: ${reason}`);
}
```

---

### 7. GeminiLiveStream.ts:140-148 | No Listener Limit / Leak Detection

**Severity:** P2 - Important
**Type:** Memory Leak / Event Emitter Pattern

**Location:** `src/vision/GeminiLiveStream.ts:140-148` (on method)

**Description:**
No upper limit on listener count. Rapid subscriptions = memory bloat.
- Event emitter pattern accumulates listeners without bound
- Node.js warns at 10 listeners by default, but no check here
- If external code subscribes many times without unsubscribe, listeners leak
- Memory exhaustion in long sessions with repeated subscriptions

**Current Code:**
```typescript
on(listener: StreamListener): void {
  this.listeners.push(listener);  // No limit check
}
```

**Fix:**
```typescript
private static readonly MAX_LISTENERS = 10;

on(listener: StreamListener): void {
  if (this.listeners.length >= GeminiLiveStream.MAX_LISTENERS) {
    this.logger('warn', `GeminiLiveStream listener limit (${GeminiLiveStream.MAX_LISTENERS}) reached, dropping oldest listener`);
    this.listeners.shift();  // Drop oldest listener
  }
  this.listeners.push(listener);
}
```

---

### 8. VisionSession.ts:177-185 | Async Capture in setInterval (Concurrent Overflow)

**Severity:** P2 - Important
**Type:** Resource Leak / Concurrency

**Location:** `src/vision/VisionSession.ts:177-185` (startCapturing)

**Description:**
`captureOnce()` is async, but `setInterval` doesn't wait for completion.
- If `captureOnce()` takes > 500ms, setInterval queues multiple captures concurrently
- No deduplication = multiple captures buffered simultaneously
- Under slow capture source (CDP), frames pile up in memory
- Unbounded buffer growth under high latency

**Test Case:**
```typescript
// If capture source is slow (e.g., CDP over network):
// captureOnce() takes 800ms, but interval is 500ms
//
// T=0ms:    setInterval fires, captureOnce() starts
// T=500ms:  setInterval fires again, 2nd captureOnce() starts (1st still running!)
// T=800ms:  1st captureOnce() completes
// T=1000ms: setInterval fires 3rd time, 3rd captureOnce() starts (2nd still running!)
// T=1300ms: 2nd captureOnce() completes
// T=1500ms: 4th captureOnce() starts (3rd still running!)
//
// Result: 3-4 concurrent captures in flight
```

**Current Code:**
```typescript
private startCapturing(): void {
  const intervalMs = 500;
  this.captureTimer = setInterval(() => {
    this.captureOnce().catch((err) => {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    });
  }, intervalMs);
}
```

**Fix (Use setTimeout recursion instead):**
```typescript
private startCapturing(): void {
  const intervalMs = 500;

  const capture = (): void => {
    this.captureOnce()
      .catch((err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (this.state === 'capturing' || this.state === 'streaming') {
          this.captureTimer = setTimeout(capture, intervalMs);
        }
      });
  };

  capture();
}
```

This ensures capture completes before next one starts (with 500ms gap between completions).

---

### 9. VisionSession.ts:194-212 | Async Capture Without Debounce

**Severity:** P2 - Important
**Type:** Performance / Concurrency

**Location:** `src/vision/VisionSession.ts:194-212` (captureOnce)

**Description:**
`captureOnce()` is async but called from setInterval without debouncing.
- Related to issue #8, but also impacts frame quality
- If multiple captures in flight, frames are processed out of order
- Sampler may skip frames due to timing, or process stale frames

**Fix:** Combined with #8 (setTimeout recursion pattern).

---

### 10. src/vision/ScreenCapture.ts:35-43, 252-270 | Sharp Module Re-imported on Every Capture

**Severity:** P2 - Important
**Type:** Performance Inefficiency

**Location:** `src/vision/ScreenCapture.ts:35-43` (loadSharp function)

**Description:**
`loadSharp()` dynamically imports sharp module on every capture call.
- Called 1-2 times per capture (downscale + compress)
- Memory: Each dynamic import creates overhead
- Not a leak (garbage collected), but inefficient

**Current Code:**
```typescript
async function loadSharp(): Promise<SharpFactory> {
  try {
    const mod = 'sharp';
    const imported = (await import(mod)) as { default: SharpFactory };
    return imported.default;
  } catch {
    throw createVisionError('CAPTURE_FAILED', 'sharp 패키지가 설치되지 않았습니다. npm install sharp');
  }
}
```

**Fix:**
```typescript
let sharpModule: SharpFactory | null = null;

async function loadSharp(): Promise<SharpFactory> {
  if (sharpModule) return sharpModule;

  try {
    const mod = 'sharp';
    const imported = (await import(mod)) as { default: SharpFactory };
    sharpModule = imported.default;
    return sharpModule;
  } catch {
    throw createVisionError('CAPTURE_FAILED', 'sharp 패키지가 설치되지 않았습니다. npm install sharp');
  }
}
```

**Similar issue in LocalCaptureSource.ts:89-97:** `loadScreenshotDesktop()` could also cache.

---

### 11. VisionSession.ts:254-260 | Silent Listener Errors Hide Bugs

**Severity:** P2 - Important
**Type:** Observability / Debugging

**Location:** `src/vision/VisionSession.ts:254-260` (emit method)

**Description:**
`emit()` silently catches all listener errors with `catch { /* ignore */ }`.
- If listener throws, error is swallowed = hard to debug
- Prevents external tools from detecting invalid event handlers
- No logging = silent failures

**Current Code:**
```typescript
private emit(event: string, ...args: unknown[]): void {
  const list = this.listeners.get(event);
  if (!list) return;
  for (const fn of list) {
    try { fn(...args); } catch { /* ignore listener errors */ }
  }
}
```

**Fix:**
```typescript
private emit(event: string, ...args: unknown[]): void {
  const list = this.listeners.get(event);
  if (!list) return;
  for (const fn of list) {
    try { fn(...args); } catch (err) {
      this.logger('error', `Listener error on event '${event}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

---

### 12. src/vision/types.ts:76-93 | No Runtime Validation of Config

**Severity:** P2 - Important
**Type:** Defensive Programming

**Location:** `src/vision/types.ts:76-93` (VisionSessionConfig)

**Description:**
Config fields have no validation. User can pass invalid values.
- `maxDurationMs` and `inactivityTimeoutMs` can be 0 or negative
- No minimum/maximum bounds checking
- Fails at runtime rather than construction time

**Current Code:**
```typescript
export interface VisionSessionConfig {
  inactivityTimeoutMs: number;
  maxDurationMs: number;
  initialMode: CaptureMode;
  // ...
}
```

**Fix:**
```typescript
export class VisionSessionConfig {
  readonly inactivityTimeoutMs: number;
  readonly maxDurationMs: number;
  readonly initialMode: CaptureMode;

  constructor(config: Partial<VisionSessionConfig> = {}) {
    this.inactivityTimeoutMs = config.inactivityTimeoutMs ?? DEFAULT_VISION_SESSION_CONFIG.inactivityTimeoutMs;
    this.maxDurationMs = config.maxDurationMs ?? DEFAULT_VISION_SESSION_CONFIG.maxDurationMs;
    this.initialMode = config.initialMode ?? 'full';

    // Validate
    if (this.maxDurationMs <= 0) {
      throw createVisionError('REGION_INVALID', 'maxDurationMs must be positive');
    }
    if (this.inactivityTimeoutMs <= 0) {
      throw createVisionError('REGION_INVALID', 'inactivityTimeoutMs must be positive');
    }
  }
}

// Then in VisionSession constructor:
export class VisionSession {
  constructor(
    sessionId: string,
    engine: ScreenCaptureEngine,
    logger: VisionLogger,
    config?: Partial<VisionSessionConfig>,
  ) {
    this.sessionId = sessionId;
    this.engine = engine;
    this.logger = logger;
    this.config = new VisionSessionConfig(config);  // Validates
    // ...
  }
}
```

---

### 13. GeminiLiveStream.ts:172-200 | Connection Cleanup Not Guaranteed in awaitConnection

**Severity:** P2 - Important
**Type:** Resource Cleanup

**Location:** `src/vision/GeminiLiveStream.ts:172-200` (awaitConnection method)

**Description:**
If `awaitConnection()` throws before listeners attached, handlers remain registered.
- If `onOpen()` never fires but `onError()` fires, handlers aren't removed
- WebSocket listeners accumulate (NodeJS will leak memory after max listeners exceeded)

**Current Code:**
```typescript
private awaitConnection(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onOpen = (): void => { /* ... */ };
    const onError = (err: Error): void => { /* ... */ };
    const onClose = (): void => { /* ... */ };
    const onMessage = (data: Buffer | string): void => { /* ... */ };

    this.ws!.on('open', onOpen);
    this.ws!.on('error', onError);
    this.ws!.on('close', onClose);
    this.ws!.on('message', onMessage);
    // If error fires, promise rejects but handlers still registered!
  });
}
```

**Fix:**
```typescript
private awaitConnection(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onOpen = (): void => { /* ... */ };
    const onError = (err: Error): void => { /* ... */ };
    const onClose = (): void => { /* ... */ };
    const onMessage = (data: Buffer | string): void => { /* ... */ };

    const cleanup = (): void => {
      this.ws?.off('open', onOpen);
      this.ws?.off('error', onError);
      this.ws?.off('close', onClose);
      this.ws?.off('message', onMessage);
    };

    const onOpenWrapped = (): void => {
      cleanup();
      onOpen();
    };

    const onErrorWrapped = (err: Error): void => {
      cleanup();
      onError(err);
    };

    const onCloseWrapped = (): void => {
      cleanup();
      onClose();
    };

    this.ws!.on('open', onOpenWrapped);
    this.ws!.on('error', onErrorWrapped);
    this.ws!.on('close', onCloseWrapped);
    this.ws!.on('message', onMessage);
  });
}
```

---

### 14. VisionSessionManager.ts:280-283 | No Listener Cleanup on Session Replacement

**Severity:** P2 - Important
**Type:** Memory Leak

**Location:** `src/vision/VisionSession.ts:280-283` (VisionSessionManager.create)

**Description:**
When `create()` replaces existing session, listeners may not be cleared.
- `existing.end()` clears listeners now (after fix #6)
- But `sessions.set()` doesn't verify old session cleaned
- If session state not ended, listeners still active

**Current Code:**
```typescript
create(
  userId: string,
  engine: ScreenCaptureEngine,
  config?: Partial<VisionSessionConfig>,
): VisionSession {
  const existing = this.sessions.get(userId);
  if (existing && existing.getState() !== 'ended') {
    existing.end('replaced_by_new_session');
  }

  const sessionId = `vision-${userId}-${Date.now()}`;
  const session = new VisionSession(sessionId, engine, this.logger, config);
  this.sessions.set(userId, session);
  return session;
}
```

**Fix:** Already mostly correct, but add assertion:
```typescript
create(
  userId: string,
  engine: ScreenCaptureEngine,
  config?: Partial<VisionSessionConfig>,
): VisionSession {
  const existing = this.sessions.get(userId);
  if (existing && existing.getState() !== 'ended') {
    existing.end('replaced_by_new_session');
  }

  // Verify old session is truly cleaned
  if (existing && existing.getState() !== 'ended') {
    this.logger('warn', `Session for user ${userId} not properly ended before replacement`);
  }

  const sessionId = `vision-${userId}-${Date.now()}`;
  const session = new VisionSession(sessionId, engine, this.logger, config);
  this.sessions.set(userId, session);
  return session;
}
```

---

### 15. src/tools/vision/index.ts:303-334 | Fetch AbortController Never Aborts on Error

**Severity:** P2 - Important
**Type:** Resource Cleanup

**Location:** `src/tools/vision/index.ts:303-334` (visionAsk function)

**Description:**
If fetch throws before timeout, AbortController signal isn't aborted.
- Timeout cleared in finally block (correct)
- But if fetch() rejects, in-flight request may not abort properly
- Minor issue (fetch cleanup is automatic), but pattern sloppy

**Current Code:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);

try {
  const res = await fetch(url, {
    // ...
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`Gemini API HTTP ${res.status}`);
  }
  // ...
} finally {
  clearTimeout(timeout);
}
```

**Fix:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);

try {
  const res = await fetch(url, {
    // ...
    signal: controller.signal,
  });

  if (!res.ok) {
    throw new Error(`Gemini API HTTP ${res.status}`);
  }
  // ...
} catch (err) {
  controller.abort();  // Explicitly abort on error
  throw err;
} finally {
  clearTimeout(timeout);
}
```

---

### 16. LocalCaptureSource.ts:108-118 | buildResult Has Wrong Width/Height

**Severity:** P2 - Important
**Type:** Data Corruption

**Location:** `src/vision/ScreenCapture.ts:108-118` (LocalCaptureSource.buildResult)

**Description:**
`buildResult()` sets width/height to 0, losing dimension information.
- Caller gets buffer but no actual dimensions
- ScreenCaptureEngine tries to fix in compress(), but loses original dimensions
- Downstream consumers (Gemini API, logging) have incomplete metadata

**Current Code:**
```typescript
private buildResult(buffer: Buffer, mode: CaptureMode): CaptureResult {
  return {
    buffer,
    width: 0,      // <-- Wrong! Should be actual width
    height: 0,     // <-- Wrong! Should be actual height
    format: 'png',
    sizeBytes: buffer.length,
    capturedAt: new Date().toISOString(),
    mode,
  };
}
```

**Fix:**
```typescript
private async buildResult(buffer: Buffer, mode: CaptureMode): Promise<CaptureResult> {
  let width = 0;
  let height = 0;

  try {
    const sharp = await loadSharp();
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    this.logger('warn', 'Could not extract image dimensions');
  }

  return {
    buffer,
    width,
    height,
    format: 'png',
    sizeBytes: buffer.length,
    capturedAt: new Date().toISOString(),
    mode,
  };
}

// Then update callers to await
async captureFullScreen(): Promise<CaptureResult> {
  const screenshotFn = await this.loadScreenshotDesktop();
  const buffer = await screenshotFn({ format: 'png' });
  return this.buildResult(buffer, 'full');
}
```

---

### 17. AdaptiveFrameSampler.ts | No Protection Against Extreme Hashes

**Severity:** P2 - Important
**Type:** Edge Case / Robustness

**Location:** `src/vision/AdaptiveFrameSampler.ts:106-125`

**Description:**
`computeDiff()` assumes hashA and hashB same length (from MD5).
- Edge case: if implementation changes, mismatched hash lengths cause bugs
- Division by len could be zero (empty buffer = empty hash)

**Current Code:**
```typescript
private computeDiff(hashA: string, hashB: string): number {
  if (!hashB) return 1; // First frame is always different
  if (hashA === hashB) return 0;

  let diffCount = 0;
  const len = Math.min(hashA.length, hashB.length);
  for (let i = 0; i < len; i++) {
    if (hashA[i] !== hashB[i]) diffCount++;
  }
  return diffCount / len;  // Could divide by 0 if len = 0
}
```

**Fix:**
```typescript
private computeDiff(hashA: string, hashB: string): number {
  if (!hashB) return 1; // First frame is always different
  if (hashA === hashB) return 0;
  if (!hashA) return 1;

  let diffCount = 0;
  const len = Math.min(hashA.length, hashB.length);
  if (len === 0) return 1;  // Fallback for empty hashes

  for (let i = 0; i < len; i++) {
    if (hashA[i] !== hashB[i]) diffCount++;
  }
  return diffCount / len;
}
```

---

## Summary Table

| # | File | Line(s) | Priority | Issue | Category |
|---|------|---------|----------|-------|----------|
| 1 | GeminiLiveStream.ts | 263-267 | P1 | Untracked reconnect timer | Memory Leak |
| 2 | VisionSession.ts | 177-185 | P1 | Timer accumulation on resume | Resource Leak |
| 3 | VisionSession.ts | 88-92 | P1 | maxDurationTimer not paused | State Machine |
| 4 | src/tools/vision/index.ts | 33-44 | P1 | Tool layer creates implementation | Architecture |
| 5 | src/tools/vision/index.ts | 341-349 | P1 | Missing shutdown hook | Lifecycle |
| 6 | VisionSession.ts | 100-108 | P2 | Incomplete listener cleanup | Memory Leak |
| 7 | GeminiLiveStream.ts | 140-148 | P2 | No listener limit | Memory Leak |
| 8 | VisionSession.ts | 177-185 | P2 | Async in setInterval | Concurrency |
| 9 | VisionSession.ts | 194-212 | P2 | Async without debounce | Performance |
| 10 | ScreenCapture.ts | 35-43 | P2 | Sharp re-import | Performance |
| 11 | VisionSession.ts | 254-260 | P2 | Silent listener errors | Observability |
| 12 | src/vision/types.ts | 76-93 | P2 | No config validation | Defensive |
| 13 | GeminiLiveStream.ts | 172-200 | P2 | Connection cleanup not guaranteed | Resource |
| 14 | VisionSessionManager.ts | 280-283 | P2 | No cleanup on replacement | Memory Leak |
| 15 | src/tools/vision/index.ts | 303-334 | P2 | Fetch abort pattern | Resource |
| 16 | ScreenCapture.ts | 108-118 | P2 | buildResult wrong dimensions | Data |
| 17 | AdaptiveFrameSampler.ts | 114-125 | P2 | No edge case protection | Robustness |

---

## Key Architectural Patterns Violated

### 1. Resource Cleanup Pattern Gap
All async operations with timers need explicit cleanup in corresponding stop/disconnect methods.
- Missing in: GeminiLiveStream (reconnect timer), VisionSession (multiple timers)
- Solution: Track all timer IDs, clear in teardown

### 2. Event Listener Leak Pattern
No maxListeners guard or guaranteed cleanup on disconnect.
- Missing in: GeminiLiveStream, VisionSession
- Solution: Add maxListeners limit with warning, clear listeners on end()

### 3. Singleton Without Factory
Tool layer creates its own engine instead of accepting dependency.
- Missing in: src/tools/vision/index.ts ensureEngine()
- Solution: Use dependency injection or factory pattern

### 4. Async in setInterval Anti-pattern
Async tasks called by setInterval without waiting for completion.
- Present in: VisionSession.startCapturing()
- Solution: Use setTimeout recursion instead

### 5. Missing Lifecycle Hooks
No automatic shutdown on daemon exit.
- Missing in: Daemon never calls shutdownVisionService()
- Solution: Register process exit handlers

### 6. Silent Error Swallowing
Error handlers that ignore failures without logging.
- Present in: GeminiLiveStream.emit(), VisionSession.emit()
- Solution: Log errors before ignoring

---

## Recommendations for Prioritization

**Immediate (This Week):**
1. Fix P1 #1 (untracked reconnect timer) - Critical memory leak
2. Fix P1 #2 (timer accumulation) - Destroys captures under pause/resume
3. Fix P1 #3 (maxDurationTimer during pause) - Breaks session API contract

**This Sprint:**
4. Fix P1 #4 (tool layer coupling) - Architecture issue blocking testability
5. Fix P1 #5 (shutdown hook) - Resource leaks on restart
6. Fix P2 #6 (listener cleanup) - Memory leak in long-running daemon

**Next Sprint:**
7. Fix P2 #8 (async in setInterval) - Prevents concurrent overflow
8. Fix P2 #12 (config validation) - Defensive programming
9. Fix P2 #13 (connection cleanup) - WebSocket listener leak

