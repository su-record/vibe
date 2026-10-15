import { createRequire } from 'node:module';

export type ProjectLink = 'linked' | 'none' | 'synced' | 'inside' | 'taken';

// Shared with the session hook, so a project has the same wiki page name in the hook and the CLI.
const projects = createRequire(import.meta.url)('../../hooks/knowledge-projects.cjs') as {
  projectName(root: string, home: string, record?: boolean): string;
  linkProject(root: string, wiki: string, name: string): ProjectLink;
};

export const { projectName, linkProject } = projects;
