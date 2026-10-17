import fs from 'node:fs';
import { createRequire } from 'node:module';

export interface JournalSummary {
  days: number;
  entries: number;
  recent: { prompts: string[]; corrections: string[]; failed: string[] };
  repeats: {
    instructions: Array<{ text: string; count: number; sessions: number }>;
    sequences: Array<{ sequence: string; count: number; sessions: number }>;
    failures: Array<{ command: string; count: number }>;
  };
}

// Shared with the session hooks, which write the journal; the CLI only reads it.
const journal = createRequire(import.meta.url)('../../hooks/knowledge-journal.cjs') as {
  read(root: string, home?: string): Array<Record<string, unknown>>;
  summarize(entries: Array<Record<string, unknown>>): JournalSummary;
  mask(text: string): string;
  commandHeads(command: string): string[];
};

/** The journal of a project folder (keyed by its real path, as the hook keys it), summarised. */
export function journalSummary(folder: string, home?: string): JournalSummary {
  return journal.summarize(journal.read(fs.realpathSync(folder), home));
}

export const { mask, commandHeads } = journal;
