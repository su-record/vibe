/**
 * The procedure, in one place. The `next` line is built from these phrases and `checks/procedure.js`
 * proves the card, the router skill and README quote the same ones — so the model never reads two
 * procedures.
 */
export const PROCEDURE = {
  /** After building everything: one verdict. */
  build: 'first, then one vibe check --all',
  /** Only a failed scenario gets the closer look. */
  failure: 'on a failure, fix what the check names; vibe context <id> when that is not enough',
} as const;
