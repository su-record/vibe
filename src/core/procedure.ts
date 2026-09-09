/**
 * The procedure, in one place. The `next` line is built from these phrases and `checks/procedure.js`
 * proves the card, the router skill and README quote the same ones — so the model never reads two
 * procedures.
 */
export const PROCEDURE = {
  /** After building everything: one verdict. */
  build: 'then one vibe check --all',
  /** Only a failed scenario gets the closer look. */
  failure: 'on a failure, vibe context <id> then vibe check <id>',
} as const;
