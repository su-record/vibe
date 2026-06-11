/**
 * Characterization tests for detectTechStacks — lock in current behavior before refactoring.
 * These tests build real temp-dir fixtures and run against the actual implementation.
 * They MUST NOT change during or after refactoring.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectTechStacks } from './detect.js';
import type { DetectionResult } from './types.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-detect-'));
}

function writeFile(dir: string, relPath: string, content: string): void {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

function writePkg(dir: string, pkg: Record<string, unknown>): void {
  writeFile(dir, 'package.json', JSON.stringify(pkg));
}

function stackTypes(result: DetectionResult): string[] {
  return result.stacks.map(s => s.type);
}

// ── suite ──────────────────────────────────────────────────────────────────

describe('detectTechStacks — characterization', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  // ── 1. Empty directory ───────────────────────────────────────────────────
  it('empty dir → no stacks, empty details', () => {
    const result = detectTechStacks(tmp);
    expect(result.stacks).toHaveLength(0);
    expect(result.details.databases).toHaveLength(0);
    expect(result.details.stateManagement).toHaveLength(0);
    expect(result.details.hosting).toHaveLength(0);
    expect(result.details.cicd).toHaveLength(0);
    expect(result.details.capabilities).toHaveLength(0);
  });

  // ── 2. Next.js ───────────────────────────────────────────────────────────
  it('Next.js — detects typescript-nextjs', () => {
    writePkg(tmp, { name: 'myapp', dependencies: { next: '^14.0.0', react: '^18.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-nextjs');
    // "react" is also present but next takes priority
    expect(stackTypes(result)).not.toContain('typescript-react');
  });

  // ── 3. React + Vite ──────────────────────────────────────────────────────
  it('React (vite) — detects typescript-react', () => {
    writePkg(tmp, { name: 'myapp', dependencies: { react: '^18.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-react');
  });

  // ── 4. Vue ───────────────────────────────────────────────────────────────
  it('Vue — detects typescript-vue', () => {
    writePkg(tmp, { name: 'myapp', dependencies: { vue: '^3.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-vue');
  });

  // ── 5. Nuxt ──────────────────────────────────────────────────────────────
  it('Nuxt — detects typescript-nuxt and not typescript-vue', () => {
    writePkg(tmp, { name: 'myapp', dependencies: { nuxt: '^3.0.0', vue: '^3.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-nuxt');
    expect(stackTypes(result)).not.toContain('typescript-vue');
  });

  // ── 6. Django ────────────────────────────────────────────────────────────
  it('Django — detects python-django via requirements.txt', () => {
    writeFile(tmp, 'requirements.txt', 'django==4.2\npsycopg2-binary==2.9\n');
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('python-django');
    expect(result.details.databases).toContain('PostgreSQL');
  });

  // ── 7. FastAPI via pyproject.toml ────────────────────────────────────────
  it('FastAPI — detects python-fastapi via pyproject.toml', () => {
    writeFile(tmp, 'pyproject.toml', '[tool.poetry.dependencies]\nfastapi = "^0.100"\nasyncpg = "^0.27"\n');
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('python-fastapi');
    expect(result.details.databases).toContain('PostgreSQL');
  });

  // ── 8. Ruby on Rails ─────────────────────────────────────────────────────
  it('Rails — detects ruby-rails via Gemfile', () => {
    writeFile(tmp, 'Gemfile', "source 'https://rubygems.org'\ngem 'rails', '~> 7.1'\ngem 'pg'\n");
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('ruby-rails');
    expect(result.details.databases).toContain('PostgreSQL');
  });

  // ── 9. Go ────────────────────────────────────────────────────────────────
  it('Go — detects go via go.mod with Redis', () => {
    writeFile(tmp, 'go.mod', 'module example.com/myapp\n\ngo 1.21\n\nrequire github.com/go-redis/redis/v9 v9.0.0\n');
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('go');
    expect(result.details.databases).toContain('Redis');
  });

  // ── 10. Rust ─────────────────────────────────────────────────────────────
  it('Rust — detects rust via Cargo.toml with sqlx', () => {
    writeFile(tmp, 'Cargo.toml', '[package]\nname = "myapp"\nversion = "0.1.0"\n\n[dependencies]\nsqlx = "0.7"\n');
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('rust');
    expect(result.details.databases).toContain('PostgreSQL');
  });

  // ── 11. Flutter / Dart ───────────────────────────────────────────────────
  it('Flutter — detects dart-flutter via pubspec.yaml with Riverpod', () => {
    writeFile(tmp, 'pubspec.yaml', 'name: myapp\ndependencies:\n  flutter:\n    sdk: flutter\n  flutter_riverpod: ^2.0.0\n');
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('dart-flutter');
    expect(result.details.stateManagement).toContain('Riverpod');
  });

  // ── 12. Plain Node/TS ────────────────────────────────────────────────────
  it('plain Node.js — detects typescript-node via package.json with name only', () => {
    writePkg(tmp, { name: 'mylib', version: '1.0.0' });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-node');
  });

  // ── 13. Monorepo — nested detection via workspace subdirs ────────────────
  it('monorepo — detects stacks in packages/* subdirectories', () => {
    // root package.json with workspaces
    writePkg(tmp, { name: 'monorepo', workspaces: ['packages/*'] });
    // packages/web = Next.js
    writePkg(path.join(tmp, 'packages/web'), { name: 'web', dependencies: { next: '^14.0.0' } });
    // packages/api = NestJS
    writePkg(path.join(tmp, 'packages/api'), { name: 'api', dependencies: { '@nestjs/core': '^10.0.0' } });

    const result = detectTechStacks(tmp);
    const types = stackTypes(result);
    expect(types).toContain('typescript-nextjs');
    expect(types).toContain('typescript-nestjs');
  });

  // ── 14. detectInDir via conventional subdirs ──────────────────────────────
  it('conventional backend/ frontend/ subdirs are detected', () => {
    // frontend
    writePkg(path.join(tmp, 'frontend'), { name: 'fe', dependencies: { react: '^18.0.0' } });
    // backend
    writePkg(path.join(tmp, 'backend'), { name: 'be', dependencies: { '@nestjs/core': '^10.0.0' } });

    const result = detectTechStacks(tmp);
    const types = stackTypes(result);
    expect(types).toContain('typescript-react');
    expect(types).toContain('typescript-nestjs');
    // paths should reflect the subdir prefix
    const reactStack = result.stacks.find(s => s.type === 'typescript-react');
    expect(reactStack?.path).toBe('frontend');
    const nestStack = result.stacks.find(s => s.type === 'typescript-nestjs');
    expect(nestStack?.path).toBe('backend');
  });

  // ── 15. Multiple stacks in one project (monorepo + no workspaces config) ─
  it('monorepo fallback — detects stacks in apps/ without workspace config', () => {
    // no root package.json
    writePkg(path.join(tmp, 'apps/web'), { name: 'web', dependencies: { react: '^18.0.0' } });
    writeFile(path.join(tmp, 'apps/service'), 'go.mod', 'module service\n\ngo 1.21\n');

    const result = detectTechStacks(tmp);
    const types = stackTypes(result);
    expect(types).toContain('typescript-react');
    expect(types).toContain('go');
  });

  // ── 16. DB detection — multiple DBs ──────────────────────────────────────
  it('detects multiple databases from package.json deps', () => {
    writePkg(tmp, {
      name: 'myapp',
      dependencies: {
        react: '^18.0.0',
        pg: '^8.0.0',
        redis: '^4.0.0',
        mongoose: '^7.0.0',
      }
    });
    const result = detectTechStacks(tmp);
    expect(result.details.databases).toContain('PostgreSQL');
    expect(result.details.databases).toContain('Redis');
    expect(result.details.databases).toContain('MongoDB');
    // no duplicates
    const pg = result.details.databases.filter(d => d === 'PostgreSQL');
    expect(pg).toHaveLength(1);
  });

  // ── 17. State management detection ───────────────────────────────────────
  it('detects state management libraries', () => {
    writePkg(tmp, {
      name: 'myapp',
      dependencies: {
        react: '^18.0.0',
        zustand: '^4.0.0',
        '@tanstack/react-query': '^5.0.0',
      }
    });
    const result = detectTechStacks(tmp);
    expect(result.details.stateManagement).toContain('Zustand');
    expect(result.details.stateManagement).toContain('React Query');
  });

  // ── 18. Capability detection — commerce ──────────────────────────────────
  it('detects commerce capability via stripe dep', () => {
    writePkg(tmp, {
      name: 'shop',
      dependencies: { react: '^18.0.0', stripe: '^14.0.0' }
    });
    const result = detectTechStacks(tmp);
    expect(result.details.capabilities).toContain('commerce');
  });

  // ── 19. Capability detection — video ─────────────────────────────────────
  it('detects video capability via fluent-ffmpeg dep', () => {
    writePkg(tmp, {
      name: 'video-tool',
      dependencies: { 'fluent-ffmpeg': '^2.0.0' }
    });
    const result = detectTechStacks(tmp);
    expect(result.details.capabilities).toContain('video');
  });

  // ── 20. Capability detection — event-automation (with required dir) ───────
  it('detects event-automation only when dir structure present', () => {
    writePkg(tmp, {
      name: 'event-tool',
      dependencies: { nodemailer: '^6.0.0', '@notionhq/client': '^2.0.0' }
    });
    // Without required directories: no event-automation
    const resultBefore = detectTechStacks(tmp);
    expect(resultBefore.details.capabilities).not.toContain('event-automation');

    // With required directory: event-automation detected
    fs.mkdirSync(path.join(tmp, 'agents'), { recursive: true });
    const resultAfter = detectTechStacks(tmp);
    expect(resultAfter.details.capabilities).toContain('event-automation');
  });

  // ── 21. CI/CD detection ───────────────────────────────────────────────────
  it('detects GitHub Actions CI/CD', () => {
    fs.mkdirSync(path.join(tmp, '.github', 'workflows'), { recursive: true });
    writeFile(tmp, '.github/workflows/ci.yml', 'name: CI\n');
    const result = detectTechStacks(tmp);
    expect(result.details.cicd).toContain('GitHub Actions');
  });

  // ── 22. Hosting detection ─────────────────────────────────────────────────
  it('detects Vercel hosting via vercel.json', () => {
    writeFile(tmp, 'vercel.json', '{}');
    const result = detectTechStacks(tmp);
    expect(result.details.hosting).toContain('Vercel');
  });

  it('detects Docker hosting', () => {
    writeFile(tmp, 'Dockerfile', 'FROM node:20\n');
    const result = detectTechStacks(tmp);
    expect(result.details.hosting).toContain('Docker');
  });

  // ── 23. Priority: Tauri > React ───────────────────────────────────────────
  it('Tauri takes priority over React', () => {
    writePkg(tmp, {
      name: 'desktop',
      dependencies: { '@tauri-apps/api': '^1.0.0', react: '^18.0.0' }
    });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-tauri');
    expect(stackTypes(result)).not.toContain('typescript-react');
  });

  // ── 24. Angular ───────────────────────────────────────────────────────────
  it('Angular — detects typescript-angular', () => {
    writePkg(tmp, { name: 'ng-app', dependencies: { '@angular/core': '^17.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-angular');
  });

  // ── 25. Java Spring via pom.xml ───────────────────────────────────────────
  it('Java Spring — detects java-spring via pom.xml', () => {
    writeFile(tmp, 'pom.xml', '<project>\n<dependencies>\n<groupId>org.springframework</groupId>\n</dependencies>\n</project>');
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('java-spring');
  });

  // ── 26. pnpm workspace monorepo ───────────────────────────────────────────
  it('pnpm-workspace.yaml — detects stacks in workspace packages', () => {
    writeFile(tmp, 'pnpm-workspace.yaml', 'packages:\n  - "apps/*"\n');
    writePkg(path.join(tmp, 'apps/dashboard'), { name: 'dashboard', dependencies: { vue: '^3.0.0' } });

    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-vue');
    const vueStack = result.stacks.find(s => s.type === 'typescript-vue');
    expect(vueStack?.path).toBe('apps/dashboard');
  });

  // ── 27. Electron ──────────────────────────────────────────────────────────
  it('Electron — detects typescript-electron', () => {
    writePkg(tmp, { name: 'desktop', dependencies: { electron: '^28.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-electron');
  });

  // ── 28. NestJS ────────────────────────────────────────────────────────────
  it('NestJS — detects typescript-nestjs', () => {
    writePkg(tmp, { name: 'api', dependencies: { '@nestjs/core': '^10.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-nestjs');
  });

  // ── 29. Astro ─────────────────────────────────────────────────────────────
  it('Astro — detects typescript-astro', () => {
    writePkg(tmp, { name: 'blog', dependencies: { astro: '^4.0.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-astro');
  });

  // ── 30. React Native ──────────────────────────────────────────────────────
  it('React Native — detects typescript-react-native', () => {
    writePkg(tmp, { name: 'mobile', dependencies: { 'react-native': '^0.73.0' } });
    const result = detectTechStacks(tmp);
    expect(stackTypes(result)).toContain('typescript-react-native');
  });
});
