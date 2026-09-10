import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CAPTURE } from './capture-policy.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const within = (parent, child) => { const relative = path.relative(parent, child); return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };

function canonical(file) {
  if (fs.existsSync(file)) return fs.realpathSync(file);
  return path.join(canonical(path.dirname(file)), path.basename(file));
}

const aclPhases = new Set(['CREATE_DIRECTORY', 'VERIFY_DIRECTORY', 'VERIFY_FILE']);
export function windowsAclError(error, phase) {
  if (!aclPhases.has(phase)) return new Error('PRIVATE_ACL_UNVERIFIED');
  const reason = error?.code === 'ETIMEDOUT' ? 'TIMEOUT'
    : error?.status === 2 ? 'OWNER_MISMATCH' : error?.status === 3 ? 'UNEXPECTED_GRANT'
      : Number.isInteger(error?.status) ? 'SCRIPT_FAILED'
        : ['ENOENT', 'EACCES', 'EPERM'].includes(error?.code) ? 'START_FAILED' : 'UNVERIFIED';
  return new Error(`PRIVATE_ACL_${phase}_${reason}`);
}

export function privateAclCause(error) {
  return /^PRIVATE_ACL_(?:CREATE_DIRECTORY|VERIFY_DIRECTORY|VERIFY_FILE)_(?:OWNER_MISMATCH|UNEXPECTED_GRANT|SCRIPT_FAILED|START_FAILED|TIMEOUT|UNVERIFIED)$/.test(error?.message) ? error.message : null;
}

function windowsAccess(file, phase) {
  const script = `$ErrorActionPreference='Stop'; $p=$env:VIBE_BENCH_PRIVATE_ENTRY;
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;
$acl=Get-Acl -LiteralPath $p;
if($env:VIBE_BENCH_PRIVATE_CREATE -eq '1') {
  $acl.SetAccessRuleProtection($true,$false);
  $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');
  $acl.SetAccessRule($rule); $acl.SetOwner($sid); Set-Acl -LiteralPath $p -AclObject $acl;
  $acl=Get-Acl -LiteralPath $p;
}
if($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){exit 2}
$allowed=@($sid.Value,'S-1-5-18','S-1-5-32-544');
foreach($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])) {
  if($rule.AccessControlType -eq 'Allow' -and $allowed -notcontains $rule.IdentityReference.Value){exit 3}
}`;
  try { execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: 'pipe', timeout: 15000,
    env: { ...process.env, VIBE_BENCH_PRIVATE_ENTRY: file, VIBE_BENCH_PRIVATE_CREATE: phase === 'CREATE_DIRECTORY' ? '1' : '0' } }); }
  catch (error) { throw windowsAclError(error, phase); }
}

function verifyEntry(file, directory) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error('PRIVATE_PATH_NOT_REGULAR');
  if (process.platform === 'win32') windowsAccess(file, directory ? 'VERIFY_DIRECTORY' : 'VERIFY_FILE');
  else if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new Error('PRIVATE_PATH_PERMISSIONS');
  return stat;
}

export function ensurePrivateDirectory(directory, forbidden = [], { create = true } = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('PRIVATE_PATH_MUST_BE_ABSOLUTE');
  const target = canonical(directory);
  if (forbidden.filter(Boolean).some((entry) => within(canonical(path.resolve(entry)), target) || within(target, canonical(path.resolve(entry))))) throw new Error('PRIVATE_PATH_OVERLAPS_SHARED_OR_PRODUCT');
  if (!fs.existsSync(directory)) {
    if (!create) throw new Error('PRIVATE_PATH_MISSING');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (process.platform === 'win32') windowsAccess(directory, 'CREATE_DIRECTORY');
  }
  verifyEntry(directory, true);
  return target;
}

export function diagnosticFile(policy, id, kind) {
  if (!policy?.enabled) return null;
  const directory = ensurePrivateDirectory(policy.directory);
  if (!['stdout', 'stderr', 'transport', 'attempt', 'failure'].includes(kind)) throw new Error('DIAGNOSTIC_KIND_INVALID');
  return path.join(directory, `${hash(String(id))}.${kind}`);
}

export function artifactReference(file, kind) {
  const stat = verifyEntry(file, false);
  const cap = ['stdout', 'stderr'].includes(kind) ? CAPTURE.streamBytes : CAPTURE.diagnosticBytes;
  if (stat.size > cap) throw new Error('DIAGNOSTIC_LIMIT_EXCEEDED');
  return { kind, path: file, bytes: stat.size, sha256: hash(fs.readFileSync(file)), private: true };
}

export function writeDiagnostic(policy, id, kind, data, byteLimit = CAPTURE.diagnosticBytes) {
  if (!Number.isSafeInteger(byteLimit) || byteLimit < 1 || byteLimit > CAPTURE.diagnosticBytes) throw new Error('DIAGNOSTIC_LIMIT_INVALID');
  const file = diagnosticFile(policy, id, kind);
  if (!file) return null;
  const encoded = Buffer.from(JSON.stringify(data));
  fs.writeFileSync(file, encoded.subarray(0, byteLimit), { flag: 'wx', mode: 0o600 });
  return { ...artifactReference(file, kind), complete: encoded.length <= byteLimit, observedBytes: encoded.length, observedSha256: hash(encoded) };
}

export function auditDiagnostics(policy, references, forbidden = []) {
  if (!policy?.enabled) { if (references?.length) throw new Error('DIAGNOSTIC_NOT_OPTED_IN'); return; }
  const root = ensurePrivateDirectory(policy.directory, forbidden, { create: false });
  for (const reference of references ?? []) {
    if (!reference?.private || !path.isAbsolute(reference.path ?? '') || !within(root, canonical(reference.path))) throw new Error('DIAGNOSTIC_PATH_INVALID');
    const actual = artifactReference(reference.path, reference.kind);
    if (actual.bytes !== reference.bytes || actual.sha256 !== reference.sha256) throw new Error('DIAGNOSTIC_CHANGED');
  }
}
