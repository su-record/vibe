import { createHash } from 'node:crypto';

export const CAPTURE_LIMIT = 1_048_576;
export interface StreamEvidence { bytes: number; sha256: string; complete: boolean }
export interface CaptureEvidence { stdout: StreamEvidence; stderr: StreamEvidence }

/** Counts and hashes original bytes; retained bytes are bounded, never silently treated as complete. */
export function outputCapture(limit = CAPTURE_LIMIT) {
  const streams = {
    stdout: { hash: createHash('sha256'), bytes: 0, retained: 0, chunks: [] as Buffer[] },
    stderr: { hash: createHash('sha256'), bytes: 0, retained: 0, chunks: [] as Buffer[] },
  };
  let overflow = false;
  return {
    add(name: 'stdout' | 'stderr', bytes: Buffer): boolean {
      const stream = streams[name]; stream.hash.update(bytes); stream.bytes += bytes.length;
      const kept = bytes.subarray(0, Math.max(0, limit - stream.retained));
      if (kept.length) { stream.chunks.push(Buffer.from(kept)); stream.retained += kept.length; }
      overflow ||= stream.bytes > limit;
      return overflow;
    },
    finish(complete: boolean) {
      const one = (name: 'stdout' | 'stderr'): StreamEvidence => ({ bytes: streams[name].bytes, sha256: streams[name].hash.digest('hex'), complete: complete && !overflow });
      return { capture: { stdout: one('stdout'), stderr: one('stderr') },
        raw: { stdout: Buffer.concat(streams.stdout.chunks), stderr: Buffer.concat(streams.stderr.chunks) }, overflow };
    },
  };
}
