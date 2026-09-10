const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function owned(target, name) {
  const file = path.resolve(target, name), relative = path.relative(target, file);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new Error('manifest file must remain inside target');
  return file;
}

function rollback(target, file) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (path.resolve(manifest.target) !== target || !Array.isArray(manifest.files)) throw new Error('rollback manifest does not own this target');
  const paths = manifest.files.map((name) => [name, owned(target, name)]);
  for (const [name, current] of paths) if (!fs.existsSync(current) || digest(current) !== manifest.hashes?.[name]) throw new Error(`installed file changed: ${name}`);
  for (const [, current] of paths) fs.rmSync(current);
  fs.rmSync(path.join(target, '.vibe-pilot-manifest.json'));
  console.log(JSON.stringify({ rolledBack: true, target }));
}

function install(target) {
  fs.mkdirSync(target, { recursive: true });
  const record = path.join(target, '.vibe-pilot-manifest.json');
  const previous = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, 'utf8')) : null;
  const destination = owned(target, 'run.cjs');
  if (fs.existsSync(destination) && (!previous || !previous.files.includes('run.cjs') || digest(destination) !== previous.hashes?.['run.cjs'])) throw new Error('refusing to overwrite an unowned or modified run.cjs');
  const source = path.join(__dirname, 'run.cjs');
  const manifest = { target, files: ['run.cjs'], hashes: { 'run.cjs': digest(source) } };
  fs.copyFileSync(source, destination);
  fs.writeFileSync(record, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest));
}

try {
  const args = process.argv.slice(2);
  if (!args.includes('--target') || !args[args.indexOf('--target') + 1]) throw new Error('installation requires --target');
  const target = path.resolve(args[args.indexOf('--target') + 1]);
  if (args.includes('--rollback')) rollback(target, args[args.indexOf('--rollback') + 1]);
  else install(target);
} catch (error) { console.error(error.message); process.exitCode = 1; }
