import fs from 'node:fs';
import path from 'node:path';

const PRIORITY = ['corrections.md', 'work-context.md', 'reuse.md'];
const MAX_ENTRIES = 256;
const MAX_FILES = 64;
const MAX_READ_BYTES = 32_768;
const PREFIX_BYTES = 2048;
const MAX_NOTES = 8;

/** Bounded local excerpts, not generated summaries or evidence of current external state. */
export function contextNotes(directories: string[], query = '') {
  const files: string[] = [];
  let entries = 0, bytesRead = 0, filesRead = 0, partial = false;
  const warnings: string[] = [];
  // Keep handoff notes discoverable even when a research directory fills the scan budget.
  for (const directory of directories) {
    try {
      if (!fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) continue;
      for (const name of PRIORITY) {
        const file = path.join(directory, name);
        if (fs.lstatSync(file, { throwIfNoEntry: false })?.isFile()) files.push(file);
      }
    } catch { partial = true; }
  }
  function collect(directory: string, depth: number): void {
    try {
      if (!fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return;
      const dir = fs.opendirSync(directory);
      try {
        let entry: fs.Dirent | null;
        while ((entry = dir.readSync())) {
          if (++entries > MAX_ENTRIES || files.length >= MAX_FILES) { partial = true; break; }
          const file = path.join(directory, entry.name);
          if (entry.isFile() && entry.name.endsWith('.md') && !files.includes(file)) files.push(file);
          else if (entry.isDirectory() && depth < 2) collect(file, depth + 1);
          else if (entry.isDirectory()) partial = true;
        }
      } finally { dir.closeSync(); }
    } catch { if (warnings.length < 4) warnings.push(`Could not inspect ${directory}`); partial = true; }
  }
  for (const directory of directories) collect(directory, 0);
  const priority = (file: string): number => {
    const i = PRIORITY.indexOf(path.basename(file));
    return i < 0 ? PRIORITY.length : i;
  };
  const scope = (file: string): number => directories.findIndex(d => file.startsWith(`${d}${path.sep}`));
  const order = (a: string, b: string): number => priority(a) - priority(b) || scope(a) - scope(b) || a.localeCompare(b);
  files.sort(order);
  const words = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? [])].slice(0, 12);
  const excerpts: Array<{ file: string; excerpt: string; truncated: boolean; score: number }> = [];
  for (const file of files) {
    if (bytesRead >= MAX_READ_BYTES) { partial = true; break; }
    let fd: number | undefined;
    try {
      fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const stat = fs.fstatSync(fd);
      if (!stat.isFile()) continue;
      const buffer = Buffer.alloc(Math.min(PREFIX_BYTES, MAX_READ_BYTES - bytesRead));
      const n = fs.readSync(fd, buffer, 0, buffer.length, 0);
      bytesRead += n; filesRead++;
      const content = buffer.subarray(0, n).toString('utf8');
      const searchable = `${path.basename(file)} ${content}`.toLocaleLowerCase();
      const score = words.filter(word => searchable.includes(word)).length;
      if (n < stat.size) partial = true;
      if (words.length && !score) continue;
      const lines = content.split(/\r?\n/).filter(line => line.trim());
      const match = words.length ? lines.findIndex(line => words.some(word => line.toLocaleLowerCase().includes(word))) : 0;
      const excerpt = lines.slice(Math.max(0, match), Math.max(0, match) + 5).join('\n').slice(0, 400);
      excerpts.push({ file, excerpt, truncated: n < stat.size || excerpt !== content.trim(), score });
    } catch { if (warnings.length < 4) warnings.push(`Could not read ${file}`); partial = true; }
    finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  excerpts.sort((a, b) => b.score - a.score || order(a.file, b.file));
  if (excerpts.length > MAX_NOTES) partial = true;
  return { notes: excerpts.slice(0, MAX_NOTES), query, filesRead, bytesRead, partial, warnings,
    limits: { entries: MAX_ENTRIES, files: MAX_FILES, readBytes: MAX_READ_BYTES, prefixBytes: PREFIX_BYTES, notes: MAX_NOTES },
    meaning: 'Local excerpts only. Partial search may omit relevant text. Read the source when needed; notes are not current verification or permission.' };
}
