/**
 * A check observes. A `run` command that changes the world — restores a database, drops a table,
 * pushes, deploys — is not an observation, and `check --all` must not re-execute it on every run.
 * These patterns name the action; the scenario becomes `irreversible` with it unless it declared
 * its own, and the harness then asks for an authorize record before running it.
 */
const PATTERNS: Array<[string, RegExp]> = [
  ['restore', /\brestore\b/i],
  ['reset', /\breset\b/i],
  ['drop', /\bdrop\b/i],
  ['truncate', /\btruncate\b/i],
  ['seed', /\bseed(?:ing|ed)?\b/i],
  ['migrate', /\bmigrat\w*[:\s-]+(?:fresh|down|rollback|refresh|reset)\b|\b(?:rollback|down)[:\s-]+migrat/i],
  ['delete', /\brm\s+-[a-z]*r[a-z]*f?\b|\bDELETE\s+FROM\b|\bkubectl\s+delete\b/i],
  ['push', /\bgit\s+push\b/],
  ['deploy', /\bdeploy\b/i],
  ['publish', /\bnpm\s+publish\b|\bpublish\b/i],
  ['apply', /\bterraform\s+apply\b|\bkubectl\s+apply\b/i],
];

/** The destructive action a command performs, or null when it reads. */
export function mutationOf(cmd: string): string | null {
  for (const [action, re] of PATTERNS) if (re.test(cmd)) return action;
  return null;
}

/** The action word of an `irreversible` label: `restore (detected)` → `restore`, `push:origin` → `push`. */
export function actionOf(irreversible: string): string {
  return irreversible.trim().split(/[\s(:]/)[0] ?? irreversible;
}
