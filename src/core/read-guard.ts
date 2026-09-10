import { createRequire } from 'node:module';

const store = createRequire(import.meta.url)('../../hooks/slice-store.cjs') as {
  recordReadTargets(root: string, input: { intentHash: string | null; files: string[] }, env?: NodeJS.ProcessEnv): boolean;
  initializeSliceCounts(root: string, env?: NodeJS.ProcessEnv): boolean;
  readSliceCounts(root: string, env?: NodeJS.ProcessEnv): { blocked: number; warned: number } | null;
};
export const recordReadTargets = store.recordReadTargets;
export const initializeSliceCounts = store.initializeSliceCounts;
export const readSliceCounts = store.readSliceCounts;
