/**
 * DeepInit - Hierarchical AGENTS.md Generation
 * Creates AI-readable documentation hierarchy with parent references
 */

import path from 'path';

export interface DirectoryInfo {
  path: string;
  name: string;
  depth: number;
  parent?: string;
  children: string[];
  files: FileInfo[];
  purpose?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  extension: string;
  size?: number;
  isEntry?: boolean;
  description?: string;
}

export interface AgentsMdContent {
  header: string;
  parentRef?: string;
  purpose: string;
  structure: string;
  keyFiles: string;
  conventions: string;
  dependencies: string;
  notes: string;
}

// Common directory purposes
const DIRECTORY_PURPOSES: Record<string, string> = {
  src: 'Source code directory',
  lib: 'Library/utility code',
  utils: 'Utility functions',
  helpers: 'Helper functions',
  components: 'UI components',
  pages: 'Page components/routes',
  hooks: 'React/custom hooks',
  services: 'Business logic services',
  api: 'API endpoints/clients',
  models: 'Data models/schemas',
  types: 'TypeScript type definitions',
  interfaces: 'Interface definitions',
  controllers: 'Request controllers',
  routes: 'Route definitions',
  middleware: 'Middleware functions',
  config: 'Configuration files',
  constants: 'Constant values',
  assets: 'Static assets',
  styles: 'CSS/styling files',
  tests: 'Test files',
  __tests__: 'Jest test directory',
  spec: 'Test specifications',
  fixtures: 'Test fixtures/data',
  mocks: 'Mock implementations',
  scripts: 'Build/utility scripts',
  tools: 'Development tools',
  docs: 'Documentation',
  dist: 'Build output',
  build: 'Build output',
  node_modules: 'Dependencies (skip)',
  '.git': 'Git directory (skip)',
};

// File patterns to identify entry points
const ENTRY_PATTERNS = [
  /^index\.(ts|js|tsx|jsx)$/,
  /^main\.(ts|js|tsx|jsx)$/,
  /^app\.(ts|js|tsx|jsx)$/,
  /^server\.(ts|js|tsx|jsx)$/,
];

/**
 * Detect directory purpose from name
 */
export function detectDirectoryPurpose(dirName: string): string {
  const lower = dirName.toLowerCase();
  return DIRECTORY_PURPOSES[lower] || DIRECTORY_PURPOSES[dirName] || 'Project directory';
}

/**
 * Check if file is an entry point
 */
export function isEntryPoint(fileName: string): boolean {
  return ENTRY_PATTERNS.some(pattern => pattern.test(fileName));
}

/**
 * Generate AGENTS.md content for a directory
 */
export function generateAgentsMd(dir: DirectoryInfo): AgentsMdContent {
  const header = `# AGENTS.md - ${dir.name}`;

  // Parent reference
  const parentRef = dir.parent
    ? `<!-- Parent: ${path.relative(dir.path, dir.parent)}/AGENTS.md -->`
    : undefined;

  // Purpose
  const purpose = `## Purpose\n\n${dir.purpose || detectDirectoryPurpose(dir.name)}`;

  // Structure
  const structureLines = ['## Structure\n', '```'];
  structureLines.push(`${dir.name}/`);
  for (const child of dir.children) {
    structureLines.push(`├── ${child}/`);
  }
  for (const file of dir.files) {
    const marker = isEntryPoint(file.name) ? ' ← entry' : '';
    structureLines.push(`├── ${file.name}${marker}`);
  }
  structureLines.push('```');
  const structure = structureLines.join('\n');

  // Key files
  const keyFilesLines = ['## Key Files\n'];
  const entryFiles = dir.files.filter(f => isEntryPoint(f.name));
  if (entryFiles.length > 0) {
    keyFilesLines.push('### Entry Points');
    for (const file of entryFiles) {
      keyFilesLines.push(`- \`${file.name}\`: ${file.description || 'Main entry point'}`);
    }
    keyFilesLines.push('');
  }

  // Group by extension
  const byExtension = new Map<string, FileInfo[]>();
  for (const file of dir.files) {
    const ext = file.extension || 'other';
    if (!byExtension.has(ext)) byExtension.set(ext, []);
    byExtension.get(ext)!.push(file);
  }

  for (const [ext, files] of byExtension) {
    if (files.length > 5) {
      keyFilesLines.push(`- \`*.${ext}\`: ${files.length} files`);
    } else {
      for (const file of files) {
        if (!isEntryPoint(file.name)) {
          keyFilesLines.push(`- \`${file.name}\``);
        }
      }
    }
  }
  const keyFiles = keyFilesLines.join('\n');

  // Conventions (auto-detected)
  const conventions = generateConventions(dir);

  // Dependencies (child directories)
  const dependenciesLines = ['## Dependencies\n'];
  if (dir.children.length > 0) {
    dependenciesLines.push('### Child Modules');
    for (const child of dir.children) {
      dependenciesLines.push(`- [\`${child}/\`](./${child}/AGENTS.md)`);
    }
  } else {
    dependenciesLines.push('No child modules.');
  }
  const dependencies = dependenciesLines.join('\n');

  // Notes placeholder
  const notes = '## Notes\n\n<!-- Add manual notes here. They will be preserved on regeneration. -->';

  return {
    header,
    parentRef,
    purpose,
    structure,
    keyFiles,
    conventions,
    dependencies,
    notes,
  };
}

/**
 * Generate conventions based on file patterns
 */
function generateConventions(dir: DirectoryInfo): string {
  const lines = ['## Conventions\n'];

  // Detect naming conventions
  const hasKebab = dir.files.some(f => f.name.includes('-'));
  const hasCamel = dir.files.some(f => /[a-z][A-Z]/.test(f.name));
  const hasPascal = dir.files.some(f => /^[A-Z]/.test(f.name));

  if (hasPascal) lines.push('- **Naming**: PascalCase for components/classes');
  if (hasCamel) lines.push('- **Naming**: camelCase for utilities/functions');
  if (hasKebab) lines.push('- **Naming**: kebab-case for files');

  // Detect test patterns
  const hasTestFiles = dir.files.some(f =>
    f.name.includes('.test.') || f.name.includes('.spec.')
  );
  if (hasTestFiles) {
    lines.push('- **Testing**: Co-located test files (*.test.ts, *.spec.ts)');
  }

  // Detect TypeScript
  const hasTs = dir.files.some(f => f.extension === 'ts' || f.extension === 'tsx');
  if (hasTs) {
    lines.push('- **Language**: TypeScript');
  }

  if (lines.length === 1) {
    lines.push('No specific conventions detected.');
  }

  return lines.join('\n');
}

/**
 * Format full AGENTS.md content
 */
export function formatAgentsMd(content: AgentsMdContent): string {
  const sections = [content.header];

  if (content.parentRef) {
    sections.push('', content.parentRef);
  }

  sections.push('', content.purpose);
  sections.push('', content.structure);
  sections.push('', content.keyFiles);
  sections.push('', content.conventions);
  sections.push('', content.dependencies);
  sections.push('', content.notes);

  return sections.join('\n');
}

/**
 * Preserve manual notes from existing AGENTS.md
 */
export function preserveManualNotes(existing: string, newContent: string): string {
  // Extract notes section from existing
  const notesMatch = existing.match(/## Notes\n\n([\s\S]*?)(?=\n## |$)/);
  if (!notesMatch || notesMatch[1].trim() === '<!-- Add manual notes here. They will be preserved on regeneration. -->') {
    return newContent;
  }

  // Replace notes section in new content
  const preservedNotes = notesMatch[1].trim();
  return newContent.replace(
    /## Notes\n\n<!-- Add manual notes here\. They will be preserved on regeneration\. -->/,
    `## Notes\n\n${preservedNotes}`
  );
}

/**
 * Generate navigation header
 */
export function generateNavigationHeader(dir: DirectoryInfo, rootPath: string): string {
  const parts = dir.path.replace(rootPath, '').split(path.sep).filter(Boolean);
  const breadcrumbs = parts.map((part, i) => {
    const depth = parts.length - i;
    const prefix = '../'.repeat(depth);
    return `[${part}](${prefix}AGENTS.md)`;
  });

  if (breadcrumbs.length === 0) {
    return '📍 Root';
  }

  return `📍 ${breadcrumbs.join(' / ')}`;
}

/**
 * Describe DeepInit workflow
 */
export function describeDeepInitWorkflow(): string {
  return `
## DeepInit Workflow

Hierarchical AI-readable documentation generation:

\`\`\`
project/
├── AGENTS.md              ← Root documentation
├── src/
│   ├── AGENTS.md          ← <!-- Parent: ../AGENTS.md -->
│   ├── components/
│   │   └── AGENTS.md      ← <!-- Parent: ../AGENTS.md -->
│   └── services/
│       └── AGENTS.md      ← <!-- Parent: ../AGENTS.md -->
└── tests/
    └── AGENTS.md          ← <!-- Parent: ../AGENTS.md -->
\`\`\`

Features:
- Parent references for navigation
- Auto-detected purpose and conventions
- Preserved manual notes on regeneration
- Entry point identification
- Child module linking
`.trim();
}
