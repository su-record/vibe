const fs = require('node:fs');
const path = require('node:path');
const { sliceTargets } = require('./slice-command.cjs');
const { readTargets, recordSlice } = require('./slice-store.cjs');

function within(directory, file) {
  const relative = path.relative(directory, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}
function exempt(root, file) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  return /(?:^|\/)\.dev(?:\/|$)/.test(relative) || /\.log(?:\.[\w-]+)?$/i.test(file);
}
function protectedFile(root, file, files) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  if (relative === '.vibe' || relative === '.vibe/intent.md' || /(?:^|\/)scenarios\.ya?ml$/i.test(relative) || /(?:^|\/)specs?(?:\/|$)/i.test(relative)) return true;
  return files.some(protectedPath => file === protectedPath || within(file, protectedPath));
}
function sourceFile(file) {
  if (/\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|c|cpp|h|cs|rb|sh|sql|md|mdx|txt|rst|json|ya?ml|toml|ini|xml|html|css|csv|tsv)$/i.test(file)) return true;
  if (/^(?:README|Dockerfile|Makefile)(?:\..*)?$/i.test(path.basename(file))) return true;
  try { return fs.lstatSync(file).isDirectory(); } catch { return false; }
}
function guidance(client) {
  const tool = client === 'codex' ? 'cat (the entire file)' : 'the Read tool (the entire file)';
  return `Open the selected files in full with ${tool}. Read fewer files from vibe state; use grep/rg/find only to locate files or lines. For over 400 lines when not editing, use vibe read --ask.`;
}
function sliceGuard(root, command, client = 'claude', cwd = root) {
  try { root = fs.realpathSync(root); cwd = fs.realpathSync(path.resolve(root, cwd)); } catch { return { decision: 'none', unavailable: true }; }
  const targets = sliceTargets(command, cwd);
  if (targets.unavailable) return { decision: 'none', unavailable: true };
  const files = targets.files.filter(file => !exempt(root, file));
  if (!files.length) return { decision: 'none', unavailable: false };
  const mirror = readTargets(root);
  const decision = files.some(file => protectedFile(root, file, mirror.files)) ? 'block' : files.some(sourceFile) ? 'warn' : 'none';
  if (decision === 'none') return { decision, unavailable: !mirror.available };
  const recorded = recordSlice(root, decision);
  const unavailable = !mirror.available || !recorded;
  return { decision, unavailable, recorded, message: `[vibe] ${decision === 'block' ? 'Partial reading of a protected file is blocked.' : 'Partial source/document reading can omit requirements.'} ${guidance(client)}${unavailable ? ' Read-target mirror or count storage unavailable.' : ''}` };
}
module.exports = { sliceGuard };
