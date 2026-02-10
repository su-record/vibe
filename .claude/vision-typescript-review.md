# TypeScript Review: Vision Pipeline (Phase 4)
**Date**: 2026-02-10 | **Reviewer**: TypeScript Reviewer Agent | **Model**: Haiku

---

## Executive Summary

- **Files Reviewed**: 6 files (1,069 LOC)
- **Type Safety**: Good (No `any` types, explicit return types present)
- **Critical Issues**: 3 P1 issues blocking merge
- **Important Issues**: 6 P2 issues recommended for fix
- **Code Quality**: 7/10 - Good patterns, some DRY violations and boundary validation gaps

---

## P1 CRITICAL (Must Fix Before Merge)

### 1. Unsafe JSON.parse at CLI Tool Result Boundary

**Files**: `c:\Users\endba\WorkSpace\vibe\src\cli\commands\vision.ts:13, 33, 59`

**Issue**: `JSON.parse(result.content[0].text)` assumes ToolResult structure without validation. Crash on malformed response.

```typescript
// CURRENT (BAD) - visionStartCmd, visionStopCmd, visionSnapshotCmd
const result = await visionStart({ mode });
const data = JSON.parse(result.content[0].text);  // Crash if:
                                                   // - content undefined
                                                   // - content[0] missing
                                                   // - text property missing
                                                   // - JSON invalid
```

**Risk Level**: HIGH - Production crash on unexpected tool response format

**Fix**:
```typescript
// GOOD - Extract ToolResult parser
function parseToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid tool result: must be an object');
  }

  const typed = result as Record<string, unknown>;
  if (!Array.isArray(typed.content)) {
    throw new Error('Invalid tool result: content must be an array');
  }

  if (typed.content.length === 0) {
    throw new Error('Invalid tool result: content array is empty');
  }

  const first = typed.content[0];
  if (!first || typeof first !== 'object') {
    throw new Error('Invalid tool result: content[0] must be an object');
  }

  const textContent = first as Record<string, unknown>;
  if (typeof textContent.text !== 'string') {
    throw new Error('Invalid tool result: text property must be a string');
  }

  try {
    return JSON.parse(textContent.text);
  } catch (e) {
    throw new Error(`Invalid tool result JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Usage in visionStartCmd, visionStopCmd, visionSnapshotCmd
const data = parseToolResult(result);
if (typeof data !== 'object' || data === null || !('error' in data)) {
  throw new Error('Invalid response structure');
}
```

**Locations**:
- Line 13: `visionStartCmd()` - after `const result = await visionStart(...)`
- Line 33: `visionStopCmd()` - after `const result = await visionStop()`
- Line 59: `visionSnapshotCmd()` - after `const result = await visionSnapshot(...)`

---

### 2. Missing Gemini API Response Validation

**File**: `c:\Users\endba\WorkSpace\vibe\src\tools\vision\index.ts:326-329`

**Issue**: Type assertion `as { candidates?: ... }` without validating API error responses. Silent failure when API returns error.

```typescript
// CURRENT (BAD)
const data = (await res.json()) as {
  candidates?: Array<{ content: { parts: Array<{ text?: string }> } }>;
};
const answer = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
// If API returns { error: "..." }, answer becomes empty string (silent failure)
```

**Risk Level**: HIGH - Silent failures mask API errors, hard to debug

**Gemini API Response Contract** (from documentation):
- Success: `{ candidates: [{ content: { parts: [{ text: string }] } }] }`
- Error: `{ error: { code: number; message: string } }`

**Fix**:
```typescript
// GOOD - Validate API response contract
interface GeminiResponsePart {
  text?: string;
}

interface GeminiResponseContent {
  parts: GeminiResponsePart[];
}

interface GeminiResponseCandidate {
  content: GeminiResponseContent;
}

interface GeminiApiResponse {
  error?: {
    code: number;
    message: string;
  };
  candidates?: GeminiResponseCandidate[];
}

// In visionAsk, replace lines 326-329:
const data = (await res.json()) as unknown;

// Type guard for response
if (!data || typeof data !== 'object') {
  throw new Error('Gemini API returned invalid response');
}

const response = data as GeminiApiResponse;

// Check for error first
if (response.error) {
  throw new Error(`Gemini API error: ${response.error.message} (code: ${response.error.code})`);
}

// Validate success structure
if (!response.candidates || response.candidates.length === 0) {
  throw new Error('Gemini API returned no candidates');
}

const answer = response.candidates[0]?.content?.parts?.[0]?.text ?? '';
if (!answer) {
  throw new Error('Gemini API returned empty response');
}
```

---

### 3. Repeated CaptureMode Validation (DRY Violation)

**File**: `c:\Users\endba\WorkSpace\vibe\src\tools\vision\index.ts:193-194, 243-244, 263-264`

**Issue**: Validation logic duplicated 3 times with identical patterns. Violates DRY principle and increases maintenance burden.

```typescript
// CURRENT (BAD) - Appears in visionStart (193-194), visionMode (243-244), visionSnapshot (263-264)
const validModes = ['full', 'region', 'window'] as const;
const mode: CaptureMode = validModes.includes(args.mode as CaptureMode)
  ? (args.mode as CaptureMode)
  : 'full';
```

**Risk Level**: MEDIUM - Type unsafe cast, DRY violation makes future updates error-prone

**Fix**:
```typescript
// GOOD - Extract mode validation helper
function parseCaptureMode(input: unknown, defaultMode: CaptureMode = 'full'): CaptureMode {
  const validModes = ['full', 'region', 'window'] as const;
  if (typeof input === 'string' && validModes.includes(input as CaptureMode)) {
    return input as CaptureMode;
  }
  return defaultMode;
}

// Usage in visionStart, visionMode, visionSnapshot:
const mode = parseCaptureMode(args.mode);
```

**Locations**:
- Line 193-194 in `visionStart()`
- Line 243-244 in `visionMode()`
- Line 263-264 in `visionSnapshot()`

---

## P2 IMPORTANT (Should Fix)

### 4. RemoteCaptureSource Missing Logger Parameter

**File**: `c:\Users\endba\WorkSpace\vibe\src\vision\ScreenCapture.ts:190-207` and `tools/vision/index.ts:39`

**Issue**: Interface inconsistency - RemoteCaptureSource doesn't accept logger, unlike LocalCaptureSource and CDPCaptureSource.

```typescript
// CURRENT (BAD) - ScreenCapture.ts:190
export class RemoteCaptureSource implements ICaptureSource {
  readonly type = 'remote' as const;
  // No logger field, no constructor
}

// vs. LocalCaptureSource (line 54-60) and CDPCaptureSource (line 129-136) both accept logger:
export class LocalCaptureSource implements ICaptureSource {
  constructor(logger: VisionLogger) { ... }
}

// Instantiation - tools/vision/index.ts:39
const sources = [
  new LocalCaptureSource(logger),        // ✓ Has logger
  new CDPCaptureSource(logger),          // ✓ Has logger
  new RemoteCaptureSource(),             // ✗ Missing logger
];
```

**Risk Level**: MEDIUM - Interface inconsistency, missing logging capability in Phase 6

**Fix**:
```typescript
// GOOD - Make RemoteCaptureSource consistent
export class RemoteCaptureSource implements ICaptureSource {
  readonly type = 'remote' as const;
  private logger: VisionLogger;

  constructor(logger: VisionLogger) {
    this.logger = logger;
  }

  isAvailable(): boolean {
    return false;  // Not yet implemented
  }

  async captureFullScreen(): Promise<CaptureResult> {
    this.logger('warn', 'RemoteCaptureSource not yet implemented (Phase 6)');
    throw createVisionError('CAPTURE_FAILED', 'RemoteCaptureSource will be implemented in Phase 6.');
  }

  async captureRegion(_region: CaptureRegion): Promise<CaptureResult> {
    this.logger('warn', 'RemoteCaptureSource not yet implemented (Phase 6)');
    throw createVisionError('CAPTURE_FAILED', 'RemoteCaptureSource will be implemented in Phase 6.');
  }

  async captureWindow(_windowId: string): Promise<CaptureResult> {
    this.logger('warn', 'RemoteCaptureSource not yet implemented (Phase 6)');
    throw createVisionError('CAPTURE_FAILED', 'RemoteCaptureSource will be implemented in Phase 6.');
  }
}

// Update instantiation - tools/vision/index.ts:39
const sources = [
  new LocalCaptureSource(logger),
  new CDPCaptureSource(logger),
  new RemoteCaptureSource(logger),  // ✓ Now consistent
];
```

---

### 5. Non-Null Assertion in Promise Callback

**File**: `c:\Users\endba\WorkSpace\vibe\src\vision\GeminiLiveStream.ts:195-198`

**Issue**: Non-null assertions `this.ws!` used in promise callbacks despite already having null check. Masks control flow intent.

```typescript
// CURRENT (BAD) - Lines 195-198
private awaitConnection(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // ... setup ...
    this.ws!.on('open', onOpen);       // ✗ Non-null assertion
    this.ws!.on('error', onError);     // ✗ Non-null assertion
    this.ws!.on('close', onClose);     // ✗ Non-null assertion
    this.ws!.on('message', onMessage); // ✗ Non-null assertion
  });
}

// Problem: ws was assigned on line 93, but callbacks execute async
// The assertions mask intent - are we sure ws won't become null?
```

**Risk Level**: MEDIUM - Defensive assertion reduces code clarity, doesn't match TypeScript best practices

**Fix**:
```typescript
// GOOD - Use local binding as type guard
private awaitConnection(): Promise<void> {
  if (!this.ws) {
    return Promise.reject(
      createVisionError('GEMINI_CONNECTION_FAILED', 'WebSocket not initialized')
    );
  }

  return new Promise<void>((resolve, reject) => {
    const ws = this.ws; // Type guard: ws is now guaranteed non-null in closure

    const onOpen = (): void => {
      this.setupHeartbeat();
      this.sendSetup();
      this.reconnectAttempts = 0;
      this.logger('info', 'GeminiLiveStream connected');
      resolve();
    };

    const onError = (err: Error): void => {
      this.logger('error', `GeminiLiveStream error: ${err.message}`);
      reject(err);
    };

    const onClose = (): void => {
      this.handleDisconnect();
    };

    const onMessage = (data: Buffer | string): void => {
      this.handleMessage(data);
    };

    ws.on('open', onOpen);
    ws.on('error', onError);
    ws.on('close', onClose);
    ws.on('message', onMessage);
  });
}
```

---

### 6. Missing Region Boundary Validation

**File**: `c:\Users\endba\WorkSpace\vibe\src\tools\vision\index.ts:197-198, 247-248, 267-268`

**Issue**: Region arguments (x, y, width, height) are checked for existence but not validated for valid ranges. Negative or zero dimensions allowed.

```typescript
// CURRENT (BAD) - Existence check only
if (mode === 'region' && args.x != null && args.y != null && args.width != null && args.height != null) {
  region = { x: args.x, y: args.y, width: args.width, height: args.height };
}
// What if args.x = -100? args.width = 0? args.height = -50?
// No validation happens until ScreenCapture.validateRegion (line 99-106)
// And that validation only checks minimum size, not negative values
```

**Risk Level**: MEDIUM - Invalid region data passed to capture engine, inconsistent validation layers

**Fix**:
```typescript
// GOOD - Extract and centralize region validation
function validateAndParseRegion(
  args: { x?: number; y?: number; width?: number; height?: number },
): CaptureRegion | undefined {
  // Check if region specified
  if (args.x == null || args.y == null || args.width == null || args.height == null) {
    return undefined;
  }

  // Validate all are finite numbers
  if (!Number.isFinite(args.x) || !Number.isFinite(args.y) ||
      !Number.isFinite(args.width) || !Number.isFinite(args.height)) {
    throw new Error('Region coordinates must be finite numbers (no NaN or Infinity)');
  }

  // Validate positive dimensions
  if (args.x < 0 || args.y < 0) {
    throw new Error('Region coordinates must be non-negative');
  }

  if (args.width <= 0 || args.height <= 0) {
    throw new Error('Region width and height must be positive');
  }

  // Validate minimum size
  if (args.width < 100 || args.height < 100) {
    throw new Error('Region must be at least 100x100px');
  }

  return { x: args.x, y: args.y, width: args.width, height: args.height };
}

// Usage in visionStart (line 197-198), visionMode (line 247-248), visionSnapshot (line 267-268):
if (mode === 'region') {
  region = validateAndParseRegion(args);  // Throws if invalid, returns undefined if not specified
}
```

---

### 7. CLI Error Handling Doesn't Distinguish Error Types

**File**: `c:\Users\endba\WorkSpace\vibe\src\cli\commands\vision.ts:24-26, 41-42, 71-72`

**Issue**: Generic catch block treats JSON parse errors the same as tool execution errors. Users can't distinguish "malformed response" from "tool failed".

```typescript
// CURRENT (BAD)
export async function visionStartCmd(mode?: string): Promise<void> {
  try {
    const { visionStart } = await import('../../tools/vision/index.js');
    const result = await visionStart({ mode });
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`Vision start failed: ${data.error}`);
      return;
    }

    console.log('Vision Session Started');
    // ...
  } catch (err) {
    // ✗ Can't distinguish:
    // - JSON.parse error (malformed response)
    // - visionStart error (tool failed)
    // - import error (missing tool)
    console.error('Vision start failed:', err instanceof Error ? err.message : String(err));
  }
}
```

**Risk Level**: MEDIUM - Poor error messaging, difficult debugging

**Fix**:
```typescript
// GOOD - Structured error handling
function isToolResult(value: unknown): value is { content: Array<{ type: string; text: string }> } {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.content) &&
         obj.content.length > 0 &&
         typeof (obj.content[0] as any).text === 'string';
}

export async function visionStartCmd(mode?: string): Promise<void> {
  try {
    const { visionStart } = await import('../../tools/vision/index.js');
    const result = await visionStart({ mode });

    // Validate tool result structure
    if (!isToolResult(result)) {
      console.error('Vision start failed: Invalid tool response structure');
      return;
    }

    // Parse response JSON
    let data: unknown;
    try {
      data = JSON.parse(result.content[0].text);
    } catch (parseErr) {
      console.error('Vision start failed: Tool returned invalid JSON');
      if (parseErr instanceof Error) {
        console.error(`  ${parseErr.message}`);
      }
      return;
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.error('Vision start failed: Tool returned invalid response');
      return;
    }

    const response = data as Record<string, unknown>;
    if (response.error) {
      console.error(`Vision start failed: ${response.error}`);
      return;
    }

    // Success
    console.log('Vision Session Started');
    console.log(`  Session ID: ${response.sessionId}`);
    console.log(`  Mode: ${response.mode}`);
    console.log(`  State: ${response.state}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Vision start failed: ${err.message}`);
    } else {
      console.error('Vision start failed: Unknown error');
    }
  }
}

// Apply same pattern to visionStopCmd and visionSnapshotCmd
```

---

### 8. Loose Logger Type in getLogger Implementation

**File**: `c:\Users\endba\WorkSpace\vibe\src\tools\vision\index.ts:25-31`

**Issue**: getLogger only logs 'error' level, silently ignores debug/info/warn. Inconsistent with VisionLogger type contract.

```typescript
// CURRENT (BAD)
function getLogger(): VisionLogger {
  return (level, message) => {
    if (level === 'error') {
      console.error(`[vision] ${message}`);
    }
    // Silent no-op for debug, info, warn levels
  };
}
```

**Risk Level**: LOW-MEDIUM - Partial implementation, debug/info/warn messages lost silently

**Fix**:
```typescript
// GOOD - Full logger implementation
function getLogger(): VisionLogger {
  return (level, message, data) => {
    const timestamp = new Date().toISOString();
    const prefix = `[vision ${timestamp}]`;

    switch (level) {
      case 'debug':
        if (process.env.DEBUG === 'vision' || process.env.DEBUG === '*') {
          console.debug(`${prefix} DEBUG: ${message}`, data ?? '');
        }
        break;
      case 'info':
        console.log(`${prefix} INFO: ${message}`, data ?? '');
        break;
      case 'warn':
        console.warn(`${prefix} WARN: ${message}`, data ?? '');
        break;
      case 'error':
        console.error(`${prefix} ERROR: ${message}`, data ?? '');
        break;
    }
  };
}
```

---

### 9. Missing Return Type on getLogger Function

**File**: `c:\Users\endba\WorkSpace\vibe\src\tools\vision\index.ts:25`

**Status**: ✓ COMPLIANT - Explicit return type `VisionLogger` already present

```typescript
function getLogger(): VisionLogger {  // ✓ Return type specified
  return (level, message) => {
    if (level === 'error') {
      console.error(`[vision] ${message}`);
    }
  };
}
```

No action needed.

---

### 10. Unvalidated Type Casting in Gemini Error Response

**File**: `c:\Users\endba\WorkSpace\vibe\src\vision\GeminiLiveStream.ts:233`

**Issue**: `JSON.parse(data.toString()) as ServerContent` - Type assertion without validating discriminator field.

```typescript
// CURRENT (BAD) - Line 233
const msg = JSON.parse(data.toString()) as ServerContent;
// ServerContent interface doesn't define discriminator - could be any structure
// No validation that msg.serverContent or msg.serverContent.modelTurn exists
```

**Risk Level**: LOW-MEDIUM - Silent failures if unexpected message structure received

**Fix**:
```typescript
// GOOD - Type guard function
interface ServerContent {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{ text?: string }>;
    };
    turnComplete?: boolean;
  };
}

function isServerContent(value: unknown): value is ServerContent {
  if (!value || typeof value !== 'object') return false;
  // We accept any object with optional serverContent
  // (loose validation for forward compatibility)
  return true;
}

private handleMessage(data: Buffer | string): void {
  try {
    const parsed = JSON.parse(data.toString()) as unknown;
    if (!isServerContent(parsed)) {
      this.logger('warn', 'Unexpected message format from Gemini');
      return;
    }

    const msg = parsed;
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.text) {
          this.accumulated += part.text;
          this.emit({ type: 'text', text: part.text });
        }
      }
    }

    if (msg.serverContent?.turnComplete) {
      this.emit({ type: 'turn_complete', fullText: this.accumulated });
      this.accumulated = '';
    }
  } catch (err) {
    this.logger('error', `Message parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

---

## SUMMARY TABLE

| # | File | Line(s) | Priority | Category | Issue | Status |
|---|------|---------|----------|----------|-------|--------|
| 1 | vision.ts | 13, 33, 59 | P1 | Type Safety | Unsafe JSON.parse, no content[0] validation | CRITICAL |
| 2 | tools/vision/index.ts | 326-329 | P1 | Error Handling | Missing Gemini API error validation | CRITICAL |
| 3 | tools/vision/index.ts | 193, 243, 263 | P1 | Code Quality | DRY violation - repeated mode validation 3x | CRITICAL |
| 4 | ScreenCapture.ts | 190, tools/vision/index.ts:39 | P2 | Interface | RemoteCaptureSource missing logger param | IMPORTANT |
| 5 | GeminiLiveStream.ts | 195-198 | P2 | Code Quality | Non-null assertions in callbacks | IMPORTANT |
| 6 | tools/vision/index.ts | 197-198, 247-248, 267-268 | P2 | Input Validation | Missing region boundary validation | IMPORTANT |
| 7 | vision.ts | 24-26, 41-42, 71-72 | P2 | Error Handling | CLI error handling doesn't distinguish types | IMPORTANT |
| 8 | tools/vision/index.ts | 25-31 | P2 | Implementation | Logger only logs 'error' level | IMPORTANT |
| 9 | tools/vision/index.ts | 25 | - | - | ✓ Return type present | PASS |
| 10 | GeminiLiveStream.ts | 233 | P2 | Type Safety | Unvalidated JSON.parse type casting | IMPORTANT |

---

## STRENGTHS (What's Working Well)

### Code Architecture
- **Singleton Pattern**: captureEngine, sessionManager, liveStream properly cached with lazy initialization ✓
- **Clean Separation**: ScreenCapture, AdaptiveFrameSampler, GeminiLiveStream are well-isolated ✓
- **Error Types**: VisionError discriminated union with codes prevents generic Error handling ✓

### Type System
- **VisionLogger Type**: Proper literal union (`'debug' | 'info' | 'warn' | 'error'`) matches CLAUDE.md standards ✓
- **CaptureMode Type**: Literal union `'full' | 'region' | 'window'` is type-safe ✓
- **VisionSessionState**: Discriminated union for state machine is correct ✓
- **No `any` types**: Entire codebase avoids `any` type ✓

### Error Handling
- **Dynamic Imports**: Sharp, screenshot-desktop, ws all have try-catch with descriptive errors ✓
- **Listener Protection**: GeminiLiveStream.emit() catches individual listener errors (line 276) ✓
- **Graceful Degradation**: downscale and compress methods recover gracefully on failure ✓

### State Management
- **AdaptiveFrameSampler**: Clean null/NaN handling, proper state initialization ✓
- **VisionSession**: Comprehensive lifecycle management (idle → capturing → streaming → paused → ended) ✓
- **Timers**: Proper cleanup in clearTimers() prevents memory leaks ✓

---

## VIOLATIONS OF CLAUDE.md STANDARDS

### TypeScript Rules
- **P1**: Unsafe type assertions without runtime validation (visionAsk line 326)
- **P1**: JSON.parse without discriminator type guard (vision.ts lines 13, 33, 59)
- **P2**: Non-null assertions instead of type guards (GeminiLiveStream line 195-198)

### Error Handling
- **P2**: Generic catch blocks don't distinguish error types (vision.ts CLI)
- **P1**: Silent failures when API returns error (Gemini validation missing)

### Code Quality
- **P1**: DRY violation - repeated validation logic (3 locations for mode parsing)

---

## RECOMMENDATIONS FOR FIX PRIORITY

### Immediate (P1 - Before Merge)
1. **Fix JSON.parse boundary validation** in vision.ts (3 locations)
2. **Add Gemini API error validation** in tools/vision/index.ts:326-329
3. **Extract parseCaptureMode helper** to eliminate DRY violation

### Before Release (P2 - Next Sprint)
4. Add logger parameter to RemoteCaptureSource
5. Replace non-null assertions with type guards in GeminiLiveStream
6. Add region validation helper with boundary checks
7. Improve CLI error messages with type discrimination
8. Implement full logger for all levels (debug/info/warn/error)
9. Add type guard for Gemini message parsing

### Nice-to-Have (Future)
- Add structured logging with timestamps (already recommended in fix for #8)
- Add metrics/telemetry for frame sampling statistics

---

## TESTING RECOMMENDATIONS

### Unit Tests Needed
```typescript
// Test parseToolResult with edge cases
- content is undefined
- content is empty array
- content[0] is missing
- text is not string
- JSON parse fails
- data is malformed

// Test parseCapture Mode
- null/undefined input
- invalid string
- valid strings

// Test validateAndParseRegion
- missing coordinates
- NaN/Infinity values
- negative coordinates
- zero or negative dimensions
- valid region

// Test Gemini response validation
- API error response
- Empty candidates
- Missing text field
- Successful response
```

### Integration Tests Needed
```typescript
// Test CLI error messages
- JSON parse error → clear message
- Tool execution error → clear message
- Response malformed → clear message

// Test logger levels
- Each level (debug/info/warn/error) output correctly
- DEBUG environment variable controls debug level
```

---

## COMPLIANCE CHECKLIST

| Check | Status | Notes |
|-------|--------|-------|
| No `any` type usage | ✓ PASS | Zero instances found |
| Explicit return types | ✓ PASS | All functions have return types |
| Type guards before assertions | ✗ FAIL | 3 P1 issues (JSON.parse, Gemini response) |
| Error types defined | ✓ PASS | VisionError discriminated union |
| Proper null checks | ✓ PARTIAL | Some assertions instead of guards (P2 issue) |
| Input validation | ✗ FAIL | Region bounds not validated (P2 issue) |
| Error messages user-friendly | ✗ FAIL | CLI errors not distinguished (P2 issue) |
| strictNullChecks compliant | ✓ PASS | Null handling correct (except assertions) |

---

## CLAUDE.MD COMPLIANCE

**MANDATORY TypeScript Rules Violations**:
- ✗ No `as any` casting → issue #2 uses `as { candidates?: ... }` without validation
- ✗ No unsafe assertions → issue #5 uses non-null assertions in callbacks
- ✗ Explicit return types → ✓ All present

**Standards Met**:
- ✓ Type Safety: No `any` type
- ✓ Error Handling: Try-catch present
- ✓ User-friendly messages: Present in most places (except CLI)

**Standards Violated**:
- ✗ Input Validation: Region bounds not checked
- ✗ Type Guards: 3 JSON.parse calls without validation

