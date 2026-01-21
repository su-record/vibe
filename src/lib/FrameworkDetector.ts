/**
 * Framework Detector - Automatically detect project framework from package.json
 * Inspired by Vercel's deploy script
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface FrameworkInfo {
  id: string;
  name: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'static' | 'docs';
  runtime?: 'node' | 'bun' | 'deno' | 'browser';
  features?: string[];
}

// Framework definitions with metadata
export const FRAMEWORKS: Record<string, FrameworkInfo> = {
  // Fullstack frameworks (check first - more specific)
  'blitzjs': { id: 'blitzjs', name: 'Blitz.js', category: 'fullstack', runtime: 'node', features: ['ssr', 'api'] },
  'nextjs': { id: 'nextjs', name: 'Next.js', category: 'fullstack', runtime: 'node', features: ['ssr', 'ssg', 'api', 'rsc'] },
  'remix': { id: 'remix', name: 'Remix', category: 'fullstack', runtime: 'node', features: ['ssr', 'nested-routes'] },
  'nuxtjs': { id: 'nuxtjs', name: 'Nuxt', category: 'fullstack', runtime: 'node', features: ['ssr', 'ssg'] },
  'sveltekit-1': { id: 'sveltekit-1', name: 'SvelteKit', category: 'fullstack', runtime: 'node', features: ['ssr', 'ssg'] },
  'solidstart-1': { id: 'solidstart-1', name: 'SolidStart', category: 'fullstack', runtime: 'node', features: ['ssr'] },
  'tanstack-start': { id: 'tanstack-start', name: 'TanStack Start', category: 'fullstack', runtime: 'node', features: ['ssr'] },
  'redwoodjs': { id: 'redwoodjs', name: 'RedwoodJS', category: 'fullstack', runtime: 'node', features: ['api', 'graphql'] },
  'hydrogen': { id: 'hydrogen', name: 'Hydrogen', category: 'fullstack', runtime: 'node', features: ['shopify', 'ssr'] },

  // Frontend frameworks
  'gatsby': { id: 'gatsby', name: 'Gatsby', category: 'frontend', runtime: 'node', features: ['ssg', 'graphql'] },
  'react-router': { id: 'react-router', name: 'React Router', category: 'frontend', runtime: 'node', features: ['spa', 'nested-routes'] },
  'astro': { id: 'astro', name: 'Astro', category: 'frontend', runtime: 'node', features: ['ssg', 'islands'] },
  'svelte': { id: 'svelte', name: 'Svelte', category: 'frontend', runtime: 'browser', features: ['reactive'] },
  'angular': { id: 'angular', name: 'Angular', category: 'frontend', runtime: 'browser', features: ['spa', 'di'] },
  'create-react-app': { id: 'create-react-app', name: 'Create React App', category: 'frontend', runtime: 'browser', features: ['spa'] },
  'vite': { id: 'vite', name: 'Vite', category: 'frontend', runtime: 'browser', features: ['hmr', 'esm'] },
  'preact': { id: 'preact', name: 'Preact', category: 'frontend', runtime: 'browser', features: ['lightweight'] },
  'ember': { id: 'ember', name: 'Ember.js', category: 'frontend', runtime: 'browser', features: ['spa', 'convention'] },

  // Backend frameworks
  'nestjs': { id: 'nestjs', name: 'NestJS', category: 'backend', runtime: 'node', features: ['di', 'decorators'] },
  'express': { id: 'express', name: 'Express', category: 'backend', runtime: 'node', features: ['minimal'] },
  'fastify': { id: 'fastify', name: 'Fastify', category: 'backend', runtime: 'node', features: ['fast', 'schema'] },
  'hono': { id: 'hono', name: 'Hono', category: 'backend', runtime: 'node', features: ['edge', 'lightweight'] },
  'elysia': { id: 'elysia', name: 'Elysia', category: 'backend', runtime: 'bun', features: ['bun', 'fast'] },
  'h3': { id: 'h3', name: 'h3', category: 'backend', runtime: 'node', features: ['minimal', 'edge'] },
  'nitro': { id: 'nitro', name: 'Nitro', category: 'backend', runtime: 'node', features: ['universal'] },

  // Documentation frameworks
  'docusaurus-2': { id: 'docusaurus-2', name: 'Docusaurus', category: 'docs', runtime: 'node', features: ['docs', 'mdx'] },
  'vitepress': { id: 'vitepress', name: 'VitePress', category: 'docs', runtime: 'node', features: ['docs', 'vue'] },
  'vuepress': { id: 'vuepress', name: 'VuePress', category: 'docs', runtime: 'node', features: ['docs', 'vue'] },
  'hexo': { id: 'hexo', name: 'Hexo', category: 'docs', runtime: 'node', features: ['blog'] },
  'eleventy': { id: 'eleventy', name: 'Eleventy', category: 'static', runtime: 'node', features: ['ssg', 'simple'] },
  'gridsome': { id: 'gridsome', name: 'Gridsome', category: 'static', runtime: 'node', features: ['vue', 'graphql'] },

  // Other
  'storybook': { id: 'storybook', name: 'Storybook', category: 'frontend', runtime: 'node', features: ['components', 'docs'] },
  'sanity-v3': { id: 'sanity-v3', name: 'Sanity', category: 'backend', runtime: 'node', features: ['cms'] },
  'ionic-angular': { id: 'ionic-angular', name: 'Ionic Angular', category: 'frontend', runtime: 'browser', features: ['mobile', 'hybrid'] },
  'ionic-react': { id: 'ionic-react', name: 'Ionic React', category: 'frontend', runtime: 'browser', features: ['mobile', 'hybrid'] },
  'stencil': { id: 'stencil', name: 'Stencil', category: 'frontend', runtime: 'browser', features: ['web-components'] },
  'umijs': { id: 'umijs', name: 'UmiJS', category: 'frontend', runtime: 'node', features: ['enterprise', 'plugins'] },
  'parcel': { id: 'parcel', name: 'Parcel', category: 'frontend', runtime: 'browser', features: ['zero-config'] },
  'dojo': { id: 'dojo', name: 'Dojo', category: 'frontend', runtime: 'browser', features: ['widgets'] },
  'polymer': { id: 'polymer', name: 'Polymer', category: 'frontend', runtime: 'browser', features: ['web-components'] },
  'sapper': { id: 'sapper', name: 'Sapper', category: 'frontend', runtime: 'node', features: ['legacy-svelte'] },
  'saber': { id: 'saber', name: 'Saber', category: 'static', runtime: 'node', features: ['vue'] },
};

// Detection order (more specific first)
const DETECTION_ORDER: { dep: string; framework: string }[] = [
  // Fullstack (most specific first)
  { dep: 'blitz', framework: 'blitzjs' },
  { dep: 'next', framework: 'nextjs' },
  { dep: '@remix-run/', framework: 'remix' },
  { dep: '@react-router/', framework: 'react-router' },
  { dep: '@tanstack/start', framework: 'tanstack-start' },
  { dep: '@shopify/hydrogen', framework: 'hydrogen' },
  { dep: '@redwoodjs/', framework: 'redwoodjs' },
  { dep: '@sveltejs/kit', framework: 'sveltekit-1' },
  { dep: '@solidjs/start', framework: 'solidstart-1' },
  { dep: 'nuxt', framework: 'nuxtjs' },
  { dep: 'astro', framework: 'astro' },
  { dep: 'gatsby', framework: 'gatsby' },

  // Frontend
  { dep: 'svelte', framework: 'svelte' },
  { dep: '@ionic/angular', framework: 'ionic-angular' },
  { dep: '@angular/core', framework: 'angular' },
  { dep: '@ionic/react', framework: 'ionic-react' },
  { dep: 'react-scripts', framework: 'create-react-app' },
  { dep: 'preact', framework: 'preact' },
  { dep: 'ember-cli', framework: 'ember' },
  { dep: 'ember-source', framework: 'ember' },
  { dep: '@dojo/framework', framework: 'dojo' },
  { dep: '@polymer/', framework: 'polymer' },
  { dep: '@stencil/core', framework: 'stencil' },
  { dep: 'umi', framework: 'umijs' },
  { dep: 'sapper', framework: 'sapper' },

  // Documentation
  { dep: '@docusaurus/core', framework: 'docusaurus-2' },
  { dep: 'vitepress', framework: 'vitepress' },
  { dep: 'vuepress', framework: 'vuepress' },
  { dep: '@11ty/eleventy', framework: 'eleventy' },
  { dep: 'hexo', framework: 'hexo' },
  { dep: 'gridsome', framework: 'gridsome' },
  { dep: 'saber', framework: 'saber' },

  // Backend
  { dep: '@nestjs/core', framework: 'nestjs' },
  { dep: 'elysia', framework: 'elysia' },
  { dep: 'hono', framework: 'hono' },
  { dep: 'fastify', framework: 'fastify' },
  { dep: 'h3', framework: 'h3' },
  { dep: 'nitropack', framework: 'nitro' },
  { dep: 'express', framework: 'express' },

  // CMS / Tools
  { dep: 'sanity', framework: 'sanity-v3' },
  { dep: '@sanity/', framework: 'sanity-v3' },
  { dep: '@storybook/', framework: 'storybook' },

  // Generic (check last)
  { dep: 'vite', framework: 'vite' },
  { dep: 'parcel', framework: 'parcel' },
];

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface DetectionResult {
  framework: FrameworkInfo | null;
  confidence: 'high' | 'medium' | 'low';
  matchedDep?: string;
  allDetected: string[]; // All frameworks found (for hybrid projects)
  packageJson?: PackageJson;
  projectType: 'monorepo' | 'single' | 'static' | 'unknown';
}

/**
 * Read and parse package.json
 */
async function readPackageJson(projectPath: string): Promise<PackageJson | null> {
  const pkgPath = join(projectPath, 'package.json');
  try {
    const content = await readFile(pkgPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if a dependency exists in package.json
 */
function hasDependency(pkg: PackageJson, dep: string): boolean {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  // Check for exact match or prefix match (e.g., "@remix-run/")
  return Object.keys(allDeps).some(key =>
    key === dep || key.startsWith(dep)
  );
}

/**
 * Detect project type (monorepo, single, static)
 */
async function detectProjectType(projectPath: string, pkg: PackageJson | null): Promise<'monorepo' | 'single' | 'static' | 'unknown'> {
  // Check for monorepo indicators
  const monorepoFiles = ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'];
  for (const file of monorepoFiles) {
    if (existsSync(join(projectPath, file))) {
      return 'monorepo';
    }
  }

  // Check for workspaces in package.json
  if (pkg && (pkg as any).workspaces) {
    return 'monorepo';
  }

  // No package.json = likely static
  if (!pkg) {
    const hasHtml = existsSync(join(projectPath, 'index.html'));
    return hasHtml ? 'static' : 'unknown';
  }

  return 'single';
}

/**
 * Detect framework from package.json
 */
export async function detectFramework(projectPath: string): Promise<DetectionResult> {
  const pkg = await readPackageJson(projectPath);
  const projectType = await detectProjectType(projectPath, pkg);
  const allDetected: string[] = [];

  if (!pkg) {
    // Check for static HTML project
    const hasHtml = existsSync(join(projectPath, 'index.html'));
    return {
      framework: hasHtml ? { id: 'static', name: 'Static HTML', category: 'static' } : null,
      confidence: hasHtml ? 'medium' : 'low',
      allDetected: hasHtml ? ['static'] : [],
      projectType,
    };
  }

  // Detect all matching frameworks
  for (const { dep, framework } of DETECTION_ORDER) {
    if (hasDependency(pkg, dep)) {
      allDetected.push(framework);
    }
  }

  // Primary framework is the first detected (most specific due to order)
  const primaryFramework = allDetected[0];
  const frameworkInfo = primaryFramework ? FRAMEWORKS[primaryFramework] : null;

  return {
    framework: frameworkInfo,
    confidence: frameworkInfo ? 'high' : 'low',
    matchedDep: primaryFramework,
    allDetected,
    packageJson: pkg,
    projectType,
  };
}

/**
 * Detect framework from string content (for analysis without file access)
 */
export function detectFrameworkFromContent(content: string): DetectionResult {
  const allDetected: string[] = [];

  for (const { dep, framework } of DETECTION_ORDER) {
    if (content.includes(`"${dep}"`) || content.includes(`"${dep}/`)) {
      allDetected.push(framework);
    }
  }

  const primaryFramework = allDetected[0];
  const frameworkInfo = primaryFramework ? FRAMEWORKS[primaryFramework] : null;

  return {
    framework: frameworkInfo,
    confidence: frameworkInfo ? 'high' : 'low',
    matchedDep: primaryFramework,
    allDetected,
    projectType: 'unknown',
  };
}

/**
 * Get recommended rules/agents based on framework
 */
export function getFrameworkRecommendations(framework: FrameworkInfo): {
  reviewers: string[];
  rules: string[];
  features: string[];
} {
  const reviewers: string[] = [];
  const rules: string[] = [];
  const features = framework.features || [];

  // Add language-specific reviewers
  if (['nextjs', 'gatsby', 'remix', 'create-react-app', 'astro'].includes(framework.id)) {
    reviewers.push('react-reviewer', 'typescript-reviewer');
    rules.push('react-*', 'async-*', 'bundle-*');
  }

  if (['nuxtjs', 'vitepress', 'vuepress', 'gridsome'].includes(framework.id)) {
    rules.push('vue-*');
  }

  if (['sveltekit-1', 'svelte'].includes(framework.id)) {
    rules.push('svelte-*');
  }

  if (['angular', 'ionic-angular'].includes(framework.id)) {
    rules.push('angular-*');
  }

  if (['nestjs', 'express', 'fastify', 'hono'].includes(framework.id)) {
    reviewers.push('typescript-reviewer');
    rules.push('server-*', 'security-*');
  }

  if (['elysia'].includes(framework.id)) {
    rules.push('bun-*');
  }

  // Always include common reviewers
  reviewers.push('security-reviewer', 'performance-reviewer');

  return { reviewers, rules, features };
}

/**
 * Format detection result for display
 */
export function formatDetectionResult(result: DetectionResult): string {
  if (!result.framework) {
    return 'No framework detected';
  }

  const lines: string[] = [];
  lines.push(`Framework: ${result.framework.name} (${result.framework.id})`);
  lines.push(`Category: ${result.framework.category}`);
  lines.push(`Confidence: ${result.confidence}`);

  if (result.framework.runtime) {
    lines.push(`Runtime: ${result.framework.runtime}`);
  }

  if (result.framework.features && result.framework.features.length > 0) {
    lines.push(`Features: ${result.framework.features.join(', ')}`);
  }

  if (result.allDetected.length > 1) {
    lines.push(`Also detected: ${result.allDetected.slice(1).join(', ')}`);
  }

  lines.push(`Project type: ${result.projectType}`);

  return lines.join('\n');
}

/**
 * Quick check if project uses a specific framework
 */
export async function isFramework(projectPath: string, frameworkId: string): Promise<boolean> {
  const result = await detectFramework(projectPath);
  return result.allDetected.includes(frameworkId);
}

/**
 * Get all supported frameworks grouped by category
 */
export function getSupportedFrameworks(): Record<string, FrameworkInfo[]> {
  const grouped: Record<string, FrameworkInfo[]> = {
    fullstack: [],
    frontend: [],
    backend: [],
    docs: [],
    static: [],
  };

  Object.values(FRAMEWORKS).forEach(fw => {
    grouped[fw.category].push(fw);
  });

  return grouped;
}
