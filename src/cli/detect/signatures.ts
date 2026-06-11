/**
 * Declarative stack-detection signature table.
 * Each entry describes what files/deps/content to look for, and what to emit.
 */

import path from 'path';
import fs from 'fs';

// ── types ──────────────────────────────────────────────────────────────────

export interface StackSignature {
  /** Unique stack identifier matched against STACK_NAMES */
  type: string;
  /**
   * If provided, the signature is only considered when the given manifest file
   * exists in the target directory.
   */
  manifestFile?: string;
  /**
   * For package.json-based stacks: list of dep keys (any match triggers).
   * Checked against `{ ...dependencies, ...devDependencies }`.
   */
  packageDeps?: string[];
  /**
   * For text-based manifests (requirements.txt, pyproject.toml, go.mod, …):
   * list of substrings. Any one match triggers.
   */
  contentIncludes?: string[];
  /**
   * Optional custom predicate — runs after file existence/dep/content checks.
   * Receives the directory and (for package.json stacks) the merged deps object.
   * Return true to confirm detection.
   */
  predicate?: (dir: string, deps: Record<string, string>) => boolean;
}

export interface CapabilitySignature {
  capability: string;
  /** package.json dep keys — any match */
  packageDeps?: string[];
  /** Content substrings for non-JS manifests — any match */
  contentIncludes?: string[];
  /** Optional extra guard — all of deps/content must also match */
  requiresDirs?: string[];
}

export interface DatabaseSignature {
  name: string;
  packageDeps?: string[];
  contentIncludes?: string[];
}

export interface StateManagementSignature {
  name: string;
  packageDeps?: string[];
  contentIncludes?: string[];
}

// ── helpers ────────────────────────────────────────────────────────────────

function hasXcodeFiles(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
  } catch { return false; }
}

function hasCsharpFiles(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(f => f.endsWith('.csproj') || f.endsWith('.sln'));
  } catch { return false; }
}

function hasGodotScripts(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(f => f.endsWith('.gd'));
  } catch { return false; }
}

// ── NODE/TS STACK SIGNATURES ───────────────────────────────────────────────
// Order matters: first match wins within a manifestFile group.

export const NODE_STACK_SIGNATURES: StackSignature[] = [
  // Desktop / Mobile (highest priority)
  { type: 'typescript-tauri',        manifestFile: 'package.json', packageDeps: ['@tauri-apps/cli', '@tauri-apps/api'] },
  { type: 'typescript-electron',     manifestFile: 'package.json', packageDeps: ['electron'] },
  { type: 'typescript-react-native', manifestFile: 'package.json', packageDeps: ['react-native'] },
  // Fullstack / SSR
  { type: 'typescript-nextjs',       manifestFile: 'package.json', packageDeps: ['next'] },
  { type: 'typescript-nuxt',         manifestFile: 'package.json', packageDeps: ['nuxt', 'nuxt3'] },
  { type: 'typescript-astro',        manifestFile: 'package.json', packageDeps: ['astro'] },
  // Frontend
  { type: 'typescript-angular',      manifestFile: 'package.json', packageDeps: ['@angular/core'] },
  { type: 'typescript-svelte',       manifestFile: 'package.json', packageDeps: ['svelte'] },
  { type: 'typescript-vue',          manifestFile: 'package.json', packageDeps: ['vue'] },
  { type: 'typescript-react',        manifestFile: 'package.json', packageDeps: ['react'] },
  // Backend
  { type: 'typescript-nestjs',       manifestFile: 'package.json', packageDeps: ['@nestjs/core'] },
  { type: 'typescript-node',         manifestFile: 'package.json', packageDeps: ['express', 'fastify', 'koa', 'hono'] },
];

// ── PYTHON STACK SIGNATURES ────────────────────────────────────────────────

export const PYTHON_STACK_SIGNATURES: StackSignature[] = [
  { type: 'python-fastapi', contentIncludes: ['fastapi'] },
  { type: 'python-django',  contentIncludes: ['django'] },
  { type: 'python',         contentIncludes: [] }, // fallback: always matches
];

// ── OTHER LANGUAGE SIGNATURES ──────────────────────────────────────────────

/** Single-file manifests that map 1-to-1 to a stack type */
export const FILE_MANIFEST_STACKS: StackSignature[] = [
  { type: 'dart-flutter', manifestFile: 'pubspec.yaml' },
  { type: 'go',           manifestFile: 'go.mod' },
  { type: 'rust',         manifestFile: 'Cargo.toml' },
];

/** Gradle-based JVM stacks */
export const GRADLE_STACK_SIGNATURES: StackSignature[] = [
  { type: 'kotlin-android', contentIncludes: ['com.android'] },
  { type: 'kotlin',         contentIncludes: ['kotlin'] },
  { type: 'java-spring',    contentIncludes: ['spring'] },
  { type: 'java',           contentIncludes: [] }, // fallback
];

/** Maven pom.xml stacks */
export const MAVEN_STACK_SIGNATURES: StackSignature[] = [
  { type: 'java-spring', contentIncludes: ['spring'] },
  { type: 'java',        contentIncludes: [] }, // fallback
];

/** Swift/iOS — requires Package.swift OR Xcode project files */
export const SWIFT_STACK_SIGNATURES: StackSignature[] = [
  {
    type: 'swift-ios',
    predicate: (dir) =>
      fs.existsSync(path.join(dir, 'Package.swift')) || hasXcodeFiles(dir),
  },
];

/** Ruby — Gemfile with "rails" keyword */
export const RUBY_STACK_SIGNATURES: StackSignature[] = [
  { type: 'ruby-rails', manifestFile: 'Gemfile', contentIncludes: ['rails'] },
];

/** C# / Unity — requires .csproj/.sln AND Unity-specific indicators */
export const CSHARP_STACK_SIGNATURES: StackSignature[] = [
  {
    type: 'csharp-unity',
    predicate: (dir) =>
      hasCsharpFiles(dir) &&
      (fs.existsSync(path.join(dir, 'ProjectSettings', 'ProjectVersion.txt')) ||
       fs.existsSync(path.join(dir, 'Assets'))),
  },
];

/** GDScript / Godot */
export const GODOT_STACK_SIGNATURES: StackSignature[] = [
  {
    type: 'gdscript-godot',
    predicate: (dir) =>
      fs.existsSync(path.join(dir, 'project.godot')) || hasGodotScripts(dir),
  },
];

// ── DATABASE SIGNATURES ────────────────────────────────────────────────────

export const DATABASE_SIGNATURES: DatabaseSignature[] = [
  // contentIncludes covers: pyproject.toml, requirements.txt, go.mod, Cargo.toml, build.gradle, pom.xml, Gemfile
  { name: 'PostgreSQL', packageDeps: ['pg', 'postgres', '@prisma/client'],  contentIncludes: ['psycopg', 'asyncpg', 'pgx', 'pq', 'postgresql', 'sqlx', 'diesel', "'pg'", '"pg"'] },
  { name: 'MySQL',      packageDeps: ['mysql', 'mysql2'],                   contentIncludes: ['mysql'] },
  { name: 'MongoDB',    packageDeps: ['mongodb', 'mongoose'],               contentIncludes: ['pymongo', 'mongo-driver', 'mongodb'] },
  { name: 'Redis',      packageDeps: ['redis', 'ioredis'],                  contentIncludes: ['go-redis'] },
  { name: 'SQLite',     packageDeps: ['sqlite3', 'better-sqlite3'],         contentIncludes: ["'sqlite3'", '"sqlite3"'] },
  { name: 'TypeORM',    packageDeps: ['typeorm'],                           contentIncludes: [] },
  { name: 'Prisma',     packageDeps: ['prisma', '@prisma/client'],          contentIncludes: ['prisma'] },
  { name: 'Drizzle',    packageDeps: ['drizzle-orm'],                       contentIncludes: [] },
  { name: 'Sequelize',  packageDeps: ['sequelize'],                         contentIncludes: [] },
  { name: 'SQLAlchemy', packageDeps: [],                                    contentIncludes: ['sqlalchemy'] },
  { name: 'JPA/Hibernate', packageDeps: [],                                 contentIncludes: ['jpa', 'hibernate'] },
];

// ── STATE MANAGEMENT SIGNATURES ────────────────────────────────────────────

export const STATE_MANAGEMENT_SIGNATURES: StateManagementSignature[] = [
  { name: 'Redux',       packageDeps: ['redux', '@reduxjs/toolkit'] },
  { name: 'Zustand',     packageDeps: ['zustand'] },
  { name: 'Jotai',       packageDeps: ['jotai'] },
  { name: 'Recoil',      packageDeps: ['recoil'] },
  { name: 'MobX',        packageDeps: ['mobx'] },
  { name: 'React Query', packageDeps: ['@tanstack/react-query', 'react-query'] },
  { name: 'SWR',         packageDeps: ['swr'] },
  { name: 'Pinia',       packageDeps: ['pinia'] },
  { name: 'Vuex',        packageDeps: ['vuex'] },
  { name: 'Riverpod',    contentIncludes: ['flutter_riverpod', 'riverpod'] },
  { name: 'Provider',    contentIncludes: ['provider'] },
  { name: 'BLoC',        contentIncludes: ['bloc'] },
  { name: 'GetX',        contentIncludes: ['getx', 'get:'] },
];

// ── CAPABILITY SIGNATURES ──────────────────────────────────────────────────

export const CAPABILITY_SIGNATURES: CapabilitySignature[] = [
  {
    capability: 'commerce',
    packageDeps: [
      'stripe', '@stripe/stripe-js', '@stripe/react-stripe-js',
      '@shopify/shopify-api', 'shopify-api-node',
      '@medusajs/medusa', '@paypal/checkout-server-sdk',
      'toss-payments', 'iamport-rest-client',
    ],
    contentIncludes: ['stripe', 'shopify', 'saleor'],
  },
  {
    capability: 'video',
    packageDeps: ['fluent-ffmpeg', '@ffmpeg/ffmpeg', 'ffmpeg-static', 'remotion', 'video.js', '@mux/mux-node'],
    contentIncludes: ['moviepy', 'ffmpeg', 'opencv', 'vidgear'],
  },
  {
    capability: 'event-automation',
    packageDeps: ['@notionhq/client', 'aligo-smartsms', 'nodemailer'],
    contentIncludes: ['notion-client', 'python-pptx', 'google-generativeai', 'aligo'],
    requiresDirs: ['agents', 'schedules', '.event_state.json', 'prompts'],
  },
];

// ── HOSTING SIGNATURES ─────────────────────────────────────────────────────

export const HOSTING_SIGNATURES: Array<{ name: string; files: string[] }> = [
  { name: 'Vercel',       files: ['vercel.json', '.vercel'] },
  { name: 'Netlify',      files: ['netlify.toml'] },
  { name: 'Google Cloud', files: ['app.yaml', 'cloudbuild.yaml'] },
  { name: 'Docker',       files: ['Dockerfile', 'docker-compose.yml'] },
  { name: 'Fly.io',       files: ['fly.toml'] },
  { name: 'Railway',      files: ['railway.json'] },
];

// ── CI/CD SIGNATURES ───────────────────────────────────────────────────────

export const CICD_SIGNATURES: Array<{ name: string; files: string[] }> = [
  { name: 'GitHub Actions', files: ['.github/workflows'] },
  { name: 'GitLab CI',      files: ['.gitlab-ci.yml'] },
  { name: 'Jenkins',        files: ['Jenkinsfile'] },
  { name: 'CircleCI',       files: ['.circleci'] },
];
