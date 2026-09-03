import path from 'node:path';
import { detectClient, detectModel } from './client.js';
import { usage } from './errors.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { writeAtomic } from './store.js';

/** 도메인 지식은 스킬이 아니다 — 문서다. 모델이 필요할 때 읽는다. */
export function knowledgeDir(root: string): string {
  return vibePath(root, 'knowledge');
}

export function addKnowledge(root: string, title: string, body: string): { file: string } {
  if (!title.trim()) throw usage('--title 이 필요하다');
  if (!body.trim()) throw usage('본문이 비어 있다');
  const slug = title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'note';
  const file = path.join(knowledgeDir(root), `${slug}.md`);
  writeAtomic(file, `# ${title}\n\n${body.trim()}\n`);
  record(root, { event: 'knowledge', client: detectClient(), model: detectModel(), detail: slug });
  return { file };
}
