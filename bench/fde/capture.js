import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { diagnosticFile, openPrivateFile, artifactReference, writeDiagnostic } from './private-artifacts.js';
import { CAPTURE } from './capture-policy.js';

function closeFile(stream) {
  if (stream.fd === null) return;
  const fd = stream.fd; stream.fd = null;
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function openStreams(diagnostics, artifactId) {
  const streams = {};
  try {
    for (const kind of ['stdout', 'stderr']) {
      const file = diagnosticFile(diagnostics, artifactId, kind);
      streams[kind] = { file, fd: file ? openPrivateFile(file) : null, prefix: null, retained: 0, bytes: 0, hash: createHash('sha256'), ended: false };
    }
    return streams;
  } catch (error) {
    for (const stream of Object.values(streams)) { try { closeFile(stream); } catch {} }
    throw error;
  }
}

function observe(stream, chunk, cap) {
  stream.hash.update(chunk); stream.bytes += chunk.length;
  const count = Math.min(cap - stream.retained, chunk.length);
  if (count > 0) {
    stream.prefix ??= Buffer.allocUnsafe(cap);
    chunk.copy(stream.prefix, stream.retained, 0, count); stream.retained += count;
    if (stream.fd !== null && fs.writeSync(stream.fd, chunk.subarray(0, count)) !== count) throw new Error('partial diagnostic write');
  }
  return stream.bytes > cap;
}

function finishStreams(streams, state) {
  const references = [], transport = {}, content = {};
  for (const [kind, stream] of Object.entries(streams)) {
    try { closeFile(stream); if (stream.file) references.push(artifactReference(stream.file, kind)); }
    catch { state.errorCode ??= 'DIAGNOSTIC_WRITE_FAILED'; state.complete = false; }
    const bytes = stream.prefix?.subarray(0, stream.retained) ?? Buffer.alloc(0);
    content[kind] = bytes.toString('utf8');
    transport[kind] = { bytes: stream.bytes, sha256: stream.hash.digest('hex'), retainedBytes: bytes.length,
      retainedSha256: createHash('sha256').update(bytes).digest('hex'), complete: state.complete && stream.ended };
    stream.prefix = null;
  }
  return { content, transport, references };
}

function finishCapture(streams, state, options) {
  if (Object.values(streams).some((stream) => !stream.ended)) { state.complete = false; state.errorCode ??= 'CLIENT_TRANSPORT_INCOMPLETE'; }
  const { content, transport, references } = finishStreams(streams, state);
  try {
    const detail = writeDiagnostic(options.diagnostics, options.artifactId, 'transport', { exit: state.exit, signal: state.signal, errorCode: state.errorCode,
      errorDetail: state.errorDetail, complete: state.complete, transport });
    if (detail) { references.push(detail); if (!detail.complete) { state.complete = false; state.errorCode ??= 'DIAGNOSTIC_LIMIT_EXCEEDED'; } }
  } catch { state.complete = false; state.errorCode ??= 'DIAGNOSTIC_WRITE_FAILED'; }
  for (const stream of Object.values(transport)) stream.complete &&= state.complete;
  for (const reference of references.filter((entry) => ['stdout', 'stderr'].includes(entry.kind))) reference.complete = transport[reference.kind].complete;
  return { ...content, exit: state.exit, signal: state.signal, complete: state.complete, errorCode: state.errorCode, transport, diagnostics: references };
}

function captureChild(command, args, options, streams, resolve) {
  const { workspace, env, prompt, timeoutMs, limits, spawnProcess } = options;
  const state = { complete: true, errorCode: null, errorDetail: null, settled: false, exit: null, signal: null };
  let child, grace;
  const finish = () => {
    if (state.settled) return;
    state.settled = true; clearTimeout(timer); clearTimeout(grace);
    for (const pipe of [child?.stdin, child?.stdout, child?.stderr]) pipe?.destroy();
    child?.unref?.(); resolve(finishCapture(streams, state, options));
  };
  const waitForClose = () => { grace ??= setTimeout(() => { state.complete = false; state.errorCode ??= 'CLIENT_TRANSPORT_INCOMPLETE'; finish(); }, limits.graceMs); };
  const fail = (code, detail = null) => {
    if (state.settled) return;
    state.complete = false; state.errorCode ??= code; state.errorDetail ??= detail; waitForClose();
    try { child?.kill('SIGKILL'); } catch {}
  };
  const timer = setTimeout(() => fail('CLIENT_TIMEOUT'), timeoutMs);
  try {
    child = spawnProcess(command, args, { cwd: workspace, env, shell: process.platform === 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    for (const [kind, stream] of Object.entries(streams)) {
      child[kind].on('data', (bytes) => {
        if (state.settled) return;
        try { if (observe(stream, bytes, limits.streamBytes)) fail('CLIENT_CAPTURE_OVERFLOW'); }
        catch { fail('DIAGNOSTIC_WRITE_FAILED'); try { closeFile(stream); } catch {} }
      });
      child[kind].on('end', () => { if (!state.settled) stream.ended = true; });
      child[kind].on('error', () => fail('CLIENT_TRANSPORT_INCOMPLETE'));
    }
    child.on('error', (error) => fail('CLIENT_START_FAILED', error.message));
    child.on('exit', (exit, signal) => { if (!state.settled) { state.exit = exit; state.signal = signal; waitForClose(); } });
    child.on('close', (exit, signal) => { if (!state.settled) { state.exit = exit; state.signal = signal; finish(); } });
    child.stdin.on('error', () => undefined); child.stdin.end(prompt);
  } catch (error) { fail('CLIENT_START_FAILED', error.message); }
}

/** Hash all observed bytes; retain a bounded prefix. No exit event is needed to settle a failure. */
export async function capture(command, args, options) {
  const limits = options.limits ?? CAPTURE;
  for (const key of ['streamBytes', 'graceMs']) if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > CAPTURE[key]) throw new Error('CAPTURE_LIMIT_INVALID');
  const { shellArgs } = await import('../../dist/core/readerSession.js');
  const streams = openStreams(options.diagnostics, options.artifactId);
  return new Promise((resolve) => captureChild(command, shellArgs(args), { ...options, limits, spawnProcess: options.spawnProcess ?? spawn }, streams, resolve));
}
