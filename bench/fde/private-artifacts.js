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

const aclPhases = new Set(['CREATE_DIRECTORY', 'CREATE_FILE', 'VERIFY_DIRECTORY', 'VERIFY_FILE']);
const aclOperations = new Map([
  [10, 'IDENTITY_FAILED'], [11, 'READ_FAILED'], [12, 'PROTECTION_FAILED'], [13, 'RULE_CREATE_FAILED'],
  [14, 'RULE_SET_FAILED'], [15, 'OWNER_SET_FAILED'], [16, 'WRITE_FAILED'], [17, 'REREAD_FAILED'],
  [18, 'OWNER_QUERY_FAILED'], [19, 'GRANTS_QUERY_FAILED'],
]);
const aclExceptions = new Map([
  [0, 'UNKNOWN'], [1, 'ARGUMENT_EXCEPTION'], [2, 'UNAUTHORIZED_ACCESS_EXCEPTION'],
  [3, 'PRIVILEGE_NOT_HELD_EXCEPTION'], [4, 'IDENTITY_NOT_MAPPED_EXCEPTION'], [5, 'PLATFORM_NOT_SUPPORTED_EXCEPTION'],
]);
const aclReasons = ['OWNER_MISMATCH', 'UNEXPECTED_GRANT', 'SCRIPT_FAILED', 'START_FAILED', 'TIMEOUT', 'UNVERIFIED',
  ...[...aclOperations.values()].flatMap(operation => [...aclExceptions.values()].map(exception => `${operation}_${exception}`))];
const aclCauses = new Set([...aclPhases].flatMap(phase => aclReasons.map(reason => `PRIVATE_ACL_${phase}_${reason}`)));

function operationFailure(status) {
  if (!Number.isInteger(status)) return null;
  const operation = aclOperations.get(Math.floor(status / 10)), exception = aclExceptions.get(status % 10);
  return operation && exception ? `${operation}_${exception}` : null;
}

export function windowsAclError(error, phase) {
  if (!aclPhases.has(phase)) return new Error('PRIVATE_ACL_UNVERIFIED');
  const reason = error?.code === 'ETIMEDOUT' ? 'TIMEOUT'
    : error?.status === 2 ? 'OWNER_MISMATCH' : error?.status === 3 ? 'UNEXPECTED_GRANT'
      : operationFailure(error?.status) ?? (Number.isInteger(error?.status) ? 'SCRIPT_FAILED'
        : ['ENOENT', 'EACCES', 'EPERM'].includes(error?.code) ? 'START_FAILED' : 'UNVERIFIED');
  return new Error(`PRIVATE_ACL_${phase}_${reason}`);
}

export function privateAclCause(error) {
  return aclCauses.has(error?.message) ? error.message : null;
}

export function windowsAclEnvironment(env = process.env) {
  // PowerShell 7 cleans module paths only when it starts Windows PowerShell directly.
  // https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.5
  return Object.fromEntries(Object.entries(env).filter(([name]) => name.toUpperCase() !== 'PSMODULEPATH'));
}

function windowsAccess(file, phase) {
  const script = `$ErrorActionPreference='Stop'; $p=$env:VIBE_BENCH_PRIVATE_ENTRY; $step=10;
try {
  $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;
  $step=11; $acl=Get-Acl -LiteralPath $p;
  if($env:VIBE_BENCH_PRIVATE_CREATE -eq 'CREATE_DIRECTORY') {
    $step=12; $acl.SetAccessRuleProtection($true,$false);
    $step=13; $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');
    $step=14; $acl.SetAccessRule($rule);
  }
  if($env:VIBE_BENCH_PRIVATE_CREATE -eq 'CREATE_DIRECTORY' -or $env:VIBE_BENCH_PRIVATE_CREATE -eq 'CREATE_FILE') {
    $step=15; $acl.SetOwner($sid);
    $step=16; Set-Acl -LiteralPath $p -AclObject $acl;
    $step=17; $acl=Get-Acl -LiteralPath $p;
  }
  $step=18; if($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){exit 2}
  $allowed=@($sid.Value,'S-1-5-18','S-1-5-32-544');
  $step=19; foreach($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])) {
    if($rule.AccessControlType -eq 'Allow' -and $allowed -notcontains $rule.IdentityReference.Value){exit 3}
  }
} catch {
  $types=@{'System.ArgumentException'=1;'System.UnauthorizedAccessException'=2;
    'System.Security.AccessControl.PrivilegeNotHeldException'=3;
    'System.Security.Principal.IdentityNotMappedException'=4;'System.PlatformNotSupportedException'=5};
  $category=0; $cause=$_.Exception;
  for($depth=0; $depth -lt 8 -and $null -ne $cause; $depth++) {
    $type=$cause.GetType().FullName;
    if($types.ContainsKey($type)){$category=$types[$type];break}
    $cause=$cause.InnerException;
  }
  exit ($step*10+$category)
}`;
  // Encode only our fixed program; paths remain data in the environment.
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  try { execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true, stdio: 'pipe', timeout: 15000,
    env: { ...windowsAclEnvironment(), VIBE_BENCH_PRIVATE_ENTRY: file, VIBE_BENCH_PRIVATE_CREATE: phase } }); }
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

export function openPrivateFile(file) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    // New Windows files use the process token's default owner, not their directory's owner.
    if (process.platform === 'win32') windowsAccess(file, 'CREATE_FILE');
    return fd;
  } catch (error) { fs.closeSync(fd); throw error; }
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
  const fd = openPrivateFile(file);
  try { fs.writeFileSync(fd, encoded.subarray(0, byteLimit)); } finally { fs.closeSync(fd); }
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
