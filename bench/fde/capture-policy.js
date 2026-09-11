// Production limits are fixed; deterministic fixtures may inject smaller limits only.
export const CAPTURE = Object.freeze({ streamBytes: 64 * 1024 * 1024, diagnosticBytes: 64 * 1024 * 1024, graceMs: 1000 });

export function completeStream(stream) {
  return stream?.complete === true && Number.isSafeInteger(stream.bytes) && stream.bytes >= 0 && stream.bytes <= CAPTURE.streamBytes
    && stream.retainedBytes === stream.bytes && /^[a-f0-9]{64}$/.test(stream.sha256 ?? '') && stream.retainedSha256 === stream.sha256;
}

export function completeCapture(session) {
  return session?.complete === true && !session.error && !session.errorCode && ['stdout', 'stderr'].every((kind) => completeStream(session.transport?.[kind]));
}
