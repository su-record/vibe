import { createRequire } from 'node:module';

/** A vault Obsidian itself has registered on this computer. */
export interface Vault {
  path: string;
  open: boolean;
  ts: number;
}

// One dependency-free module, shared with the session hook that connects the wiki once Obsidian appears.
const obsidian = createRequire(import.meta.url)('../../hooks/obsidian.cjs') as {
  obsidianRegistries(home: string, platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv): string[];
  obsidianVaults(home: string, platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv): Vault[];
  syncedBy(folder: string): string | null;
  realFolder(folder: string): string;
  carryWiki(from: string, to: string): number;
  connectVault(folder: string, home: string, platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv): 'connected' | 'in-vault' | 'waiting';
};

export const { obsidianRegistries, obsidianVaults, syncedBy, realFolder, carryWiki, connectVault } = obsidian;
