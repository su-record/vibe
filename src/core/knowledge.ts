import os from 'node:os';
import path from 'node:path';
import { detectClient, detectModel } from './client.js';
import { usage } from './errors.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { writeAtomic } from './store.js';

/** Domain knowledge is not a skill — it is a document the model reads when it needs it. */
export function knowledgeDir(root: string): string {
  return vibePath(root, 'knowledge');
}

/** Cross-project knowledge, outside any `.vibe/` — the same plain-file format, read after a project's own. */
export function globalKnowledgeDir(home: string = process.env['VIBE_HOME_DIR'] ?? os.homedir()): string {
  return path.join(home, '.config', 'vibe', 'knowledge');
}

export interface AddKnowledgeOptions {
  global?: boolean;
}

export function addKnowledge(root: string, title: string, body: string, options: AddKnowledgeOptions = {}): { file: string } {
  if (!title.trim()) throw usage('--title is required');
  if (!body.trim()) throw usage('body is empty');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'note';
  const dir = options.global ? globalKnowledgeDir() : knowledgeDir(root);
  const file = path.join(dir, `${slug}.md`);
  writeAtomic(file, `# ${title}\n\n${body.trim()}\n`);
  record(root, { event: 'knowledge', client: detectClient(), model: detectModel(), detail: options.global ? `global:${slug}` : slug });
  return { file };
}
