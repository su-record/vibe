# P2 - WebSocket Buffer Concatenation in Hot Loop

## Priority: P2 (Important)
## Category: PERF
## Status: Manual fix required

## Description
`WebServer.ts:443` uses `Buffer.concat([buffer, chunk])` on every `data` event. This creates a new buffer and copies all previous data each time, resulting in O(n^2) performance for large payloads.

## Location
- `src/interface/web/WebServer.ts:443`

## Recommended Fix
Use a `Buffer[]` array to collect chunks, then concat once when parsing is needed:
```typescript
const chunks: Buffer[] = [head];
socket.on('data', (chunk: Buffer) => {
  chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  // parse frames from buffer
  // update chunks with remaining data
});
```

Or use a ring buffer / smart buffer library.

## Impact
Under high throughput, repeated buffer allocation/copy causes GC pressure and latency spikes.
