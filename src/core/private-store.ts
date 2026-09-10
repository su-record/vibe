import { createRequire } from 'node:module';
import { denied } from './errors.js';

// One dependency-free store also ships in plugin trees without dist or node_modules.
const store = createRequire(import.meta.url)('../../hooks/private-store.cjs') as {
  inside(parent: string, file: string): boolean;
  privateDirectory(root: string, create: boolean): string;
  readPrivate(root: string, name: string, maxBytes?: number): string | null;
  writePrivate(root: string, name: string, text: string): string;
};
function local<T>(run: () => T): T {
  try { return run(); }
  catch (error) { throw denied((error as Error).message); }
}
export const inside = store.inside;
export function privateDirectory(root: string, create: boolean): string { return local(() => store.privateDirectory(root, create)); }
export function readPrivate(root: string, name: string, maxBytes?: number): string | null { return local(() => store.readPrivate(root, name, maxBytes)); }
export function writePrivate(root: string, name: string, text: string): string { return local(() => store.writePrivate(root, name, text)); }
