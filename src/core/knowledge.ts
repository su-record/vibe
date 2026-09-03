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

export function addKnowledge(root: string, title: string, body: string): { file: string } {
  if (!title.trim()) throw usage('--title is required');
  if (!body.trim()) throw usage('body is empty');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'note';
  const file = path.join(knowledgeDir(root), `${slug}.md`);
  writeAtomic(file, `# ${title}\n\n${body.trim()}\n`);
  record(root, { event: 'knowledge', client: detectClient(), model: detectModel(), detail: slug });
  return { file };
}
