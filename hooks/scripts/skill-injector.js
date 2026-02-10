#!/usr/bin/env node
/**
 * Skill Injector - Progressive Disclosure
 * Trigger-based skill injection on UserPromptSubmit
 *
 * Tier 1 - Metadata: Always loaded (name, description, triggers)
 * Tier 2 - Body: Loaded on trigger match
 * Tier 3 - Resources: Listed but not loaded (scripts/, references/, assets/)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { CORE_PATH, PROJECT_DIR } from './utils.js';
import { checkBinaryExists, checkPlatform, getInstallHint } from './skill-requirements.js';

// Skill storage locations
const USER_SKILLS_DIR = path.join(os.homedir(), '.claude', 'vibe', 'skills');
const PROJECT_SKILLS_DIR = path.join(PROJECT_DIR, '.claude', 'vibe', 'skills');

// Session cache to prevent re-injection
const SESSION_CACHE = new Set();

// Metadata cache (per-session, disk-backed)
let METADATA_CACHE = null;

// Eligibility cache (per-session)
const ELIGIBILITY_CACHE = new Map();

// Max skills per injection
const MAX_SKILLS_PER_INJECTION = 5;

// Token estimation: 1 token ≈ 4 chars
const CHARS_PER_TOKEN = 4;

// ============================================
// Tier 1: Metadata Loading
// ============================================

/**
 * Parse skill frontmatter only (no body)
 */
function loadSkillMetadataOnly(skillPath) {
  try {
    const content = fs.readFileSync(skillPath, 'utf8');
    if (!content.startsWith('---')) return null;

    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) return null;

    const frontmatter = content.slice(3, endIndex).trim();
    const metadata = {};

    for (const line of frontmatter.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      } else if (value.startsWith('{')) {
        // Parse simple objects (install hints)
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
      } else if (value.startsWith('"') || value.startsWith("'")) {
        value = value.slice(1, -1);
      } else if (/^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }

      metadata[key] = value;
    }

    return metadata;
  } catch {
    return null;
  }
}

/**
 * Load skill body only (no frontmatter)
 */
function loadSkillBody(skillPath) {
  try {
    const content = fs.readFileSync(skillPath, 'utf8');
    if (!content.startsWith('---')) return content;

    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) return content;

    return content.slice(endIndex + 3).trim();
  } catch {
    return '';
  }
}

// ============================================
// Section-Level Progressive Disclosure
// ============================================

/**
 * Parse skill body into sections (split by ## headings)
 * Returns array of { name, content } objects
 */
function parseBodySections(body) {
  const sections = [];
  const lines = body.split('\n');
  let currentSection = null;
  let currentLines = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection !== null) {
        sections.push({ name: currentSection, content: currentLines.join('\n').trim() });
      }
      currentSection = line.slice(3).trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentSection !== null) {
    sections.push({ name: currentSection, content: currentLines.join('\n').trim() });
  } else if (currentLines.length > 0) {
    sections.push({ name: '_intro', content: currentLines.join('\n').trim() });
  }

  return sections;
}

/**
 * Load skill body with section-level filtering.
 * If metadata has `sections` array, only load matching sections.
 * Otherwise, load full body (backward compatible).
 */
function loadSkillBodyWithSections(skillPath, metadata, prompt) {
  const body = loadSkillBody(skillPath);
  if (!body) return { body: '', loadedSections: [], availableSections: [] };

  const sectionsMeta = metadata.sections;
  if (!sectionsMeta || !Array.isArray(sectionsMeta) || sectionsMeta.length === 0) {
    return { body, loadedSections: [], availableSections: [] };
  }

  const parsedSections = parseBodySections(body);
  const loadedSections = [];
  const skippedSections = [];

  // Always include intro content (before first ## heading)
  let resultParts = [];
  const introSection = parsedSections.find(s => s.name === '_intro');
  if (introSection) {
    resultParts.push(introSection.content);
  }

  // Score each section defined in frontmatter
  const sectionScores = sectionsMeta.map(secMeta => {
    const triggers = secMeta.triggers;
    const score = (triggers && triggers.length > 0) ? scoreSkillMatch(triggers, prompt) : -1;
    const parsed = parsedSections.find(p =>
      p.name.toLowerCase().includes(secMeta.name.toLowerCase()) ||
      secMeta.name.toLowerCase().includes(p.name.toLowerCase())
    );
    return { meta: secMeta, score, parsed };
  });

  // Include sections with score > 0, or sections without triggers (always load)
  for (const { meta, score, parsed } of sectionScores) {
    if (!parsed) continue;

    if (score > 0 || score === -1) {
      resultParts.push(parsed.content);
      loadedSections.push(meta.name);
    } else {
      skippedSections.push(meta.name);
    }
  }

  // Include body sections NOT tracked in frontmatter (untracked always loaded)
  for (const parsed of parsedSections) {
    if (parsed.name === '_intro') continue;
    const isTracked = sectionsMeta.some(s =>
      parsed.name.toLowerCase().includes(s.name.toLowerCase()) ||
      s.name.toLowerCase().includes(parsed.name.toLowerCase())
    );
    if (!isTracked) {
      resultParts.push(parsed.content);
    }
  }

  return {
    body: resultParts.join('\n\n').trim(),
    loadedSections,
    availableSections: skippedSections,
  };
}

/**
 * List skill resources (scripts/, references/, assets/)
 */
function listSkillResources(skillDir) {
  const resources = [];
  const subDirs = ['scripts', 'references', 'assets'];

  for (const sub of subDirs) {
    const subPath = path.join(skillDir, sub);
    if (!fs.existsSync(subPath)) continue;

    try {
      const files = fs.readdirSync(subPath).filter(f => !f.startsWith('.'));
      for (const file of files) {
        resources.push(`${sub}/${file}`);
      }
    } catch {
      // Skip unreadable dirs
    }
  }

  return resources;
}

/**
 * Get disk cache path
 */
function getSkillsCachePath() {
  const cacheDir = path.join(PROJECT_DIR, '.claude', 'vibe');
  return path.join(cacheDir, '.skills-cache.json');
}

/**
 * Load all skill metadata with disk cache
 */
function loadAllMetadata() {
  if (METADATA_CACHE) return METADATA_CACHE;

  const cachePath = getSkillsCachePath();
  let diskCache = {};

  // Load disk cache
  try {
    if (fs.existsSync(cachePath)) {
      diskCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch {
    diskCache = {};
  }

  const allMetadata = [];
  const skillFiles = findSkillFiles();
  let cacheUpdated = false;

  for (const { path: skillPath, scope } of skillFiles) {
    try {
      const stat = fs.statSync(skillPath);
      const mtimeMs = stat.mtimeMs;
      const cached = diskCache[skillPath];

      if (cached && cached.mtimeMs === mtimeMs) {
        allMetadata.push({ ...cached.metadata, _path: skillPath, _scope: scope });
      } else {
        const metadata = loadSkillMetadataOnly(skillPath);
        if (metadata) {
          allMetadata.push({ ...metadata, _path: skillPath, _scope: scope });
          diskCache[skillPath] = { mtimeMs, metadata };
          cacheUpdated = true;
        }
      }
    } catch {
      // Skip unreadable
    }
  }

  // Save disk cache if updated
  if (cacheUpdated) {
    try {
      const cacheDir = path.dirname(cachePath);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(diskCache, null, 2));
    } catch {
      // Cache write failure is non-fatal
    }
  }

  METADATA_CACHE = allMetadata;
  return allMetadata;
}

// ============================================
// Skill Eligibility
// ============================================

/**
 * Check if a skill is eligible on this platform/environment
 */
function checkSkillEligibility(metadata) {
  const cacheKey = metadata._path || metadata.name;
  if (ELIGIBILITY_CACHE.has(cacheKey)) {
    return ELIGIBILITY_CACHE.get(cacheKey);
  }

  // 1. Platform check
  if (metadata.os && Array.isArray(metadata.os)) {
    if (!checkPlatform(metadata.os)) {
      const result = {
        eligible: false,
        reason: `Platform ${process.platform} not supported (requires: ${metadata.os.join(', ')})`,
      };
      ELIGIBILITY_CACHE.set(cacheKey, result);
      return result;
    }
  }

  // 2. Binary requirements check
  if (metadata.requires && Array.isArray(metadata.requires)) {
    const missing = metadata.requires.filter(b => !checkBinaryExists(b));
    if (missing.length > 0) {
      const installHint = metadata.install
        ? getInstallHint(metadata.install, process.platform)
        : null;
      const result = {
        eligible: false,
        reason: `Missing: ${missing.join(', ')}`,
        installHint,
      };
      ELIGIBILITY_CACHE.set(cacheKey, result);
      return result;
    }
  }

  const result = { eligible: true };
  ELIGIBILITY_CACHE.set(cacheKey, result);
  return result;
}

// ============================================
// Skill Matching & Scoring
// ============================================

/**
 * Find all skill files (including auto/ subdirectories)
 * Ignores .disabled files
 */
function findSkillFiles() {
  const skills = [];

  // Helper: scan directory for .md files, skip .disabled
  function scanDir(dir, scope) {
    if (!fs.existsSync(dir)) return;
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.md') && !f.endsWith('.disabled'))
        .map(f => ({ path: path.join(dir, f), scope }));
      skills.push(...files);
    } catch { /* skip unreadable */ }
  }

  // Project skills (higher priority)
  scanDir(PROJECT_SKILLS_DIR, 'project');

  // Project auto-generated skills
  scanDir(path.join(PROJECT_SKILLS_DIR, 'auto'), 'project-auto');

  // User skills
  scanDir(USER_SKILLS_DIR, 'user');

  // User auto-generated skills
  scanDir(path.join(USER_SKILLS_DIR, 'auto'), 'user-auto');

  return skills;
}

/**
 * Score skill match against prompt
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreSkillMatch(triggers, prompt) {
  if (!triggers || triggers.length === 0) return 0;

  const lowerPrompt = prompt.toLowerCase();
  let score = 0;

  for (const trigger of triggers) {
    const lowerTrigger = trigger.toLowerCase();
    if (lowerPrompt.includes(lowerTrigger)) {
      score += 10;
      const regex = new RegExp(`\\b${escapeRegex(lowerTrigger)}\\b`, 'i');
      if (regex.test(prompt)) {
        score += 5;
      }
    }
  }

  return score;
}

/**
 * Find matching skills for prompt (with eligibility check)
 */
function findMatchingSkills(prompt) {
  const allMetadata = loadAllMetadata();
  const matches = [];
  const skippedSkills = [];

  for (const meta of allMetadata) {
    const skillPath = meta._path;
    const scope = meta._scope;

    // Check session cache
    if (SESSION_CACHE.has(skillPath)) continue;

    // Check eligibility
    const eligibility = checkSkillEligibility(meta);
    if (!eligibility.eligible) {
      skippedSkills.push({
        name: meta.name || path.basename(skillPath, '.md'),
        reason: eligibility.reason,
        installHint: eligibility.installHint,
      });
      continue;
    }

    const triggers = meta.triggers || [];
    const score = scoreSkillMatch(triggers, prompt);

    if (score > 0) {
      // Tier 2: Load body on match (with section-level filtering)
      const { body: sectionBody, loadedSections, availableSections } =
        loadSkillBodyWithSections(skillPath, meta, prompt);
      let body = sectionBody;

      // Apply maxBodyTokens truncation
      if (meta.maxBodyTokens && typeof meta.maxBodyTokens === 'number') {
        const maxChars = meta.maxBodyTokens * CHARS_PER_TOKEN;
        if (body.length > maxChars) {
          body = body.slice(0, maxChars) + '\n\n<!-- [truncated: body exceeded maxBodyTokens] -->';
        }
      }

      // Tier 3: List resources
      const skillDir = path.dirname(skillPath);
      const resources = listSkillResources(skillDir);

      matches.push({
        path: skillPath,
        name: meta.name || path.basename(skillPath, '.md'),
        description: meta.description || '',
        score,
        scope,
        body,
        resources,
        metadata: meta,
        loadedSections,
        availableSections,
      });
    }
  }

  // Sort by score (descending) and scope (project > user)
  matches.sort((a, b) => {
    if (a.scope !== b.scope) {
      return a.scope === 'project' ? -1 : 1;
    }
    return b.score - a.score;
  });

  return {
    triggered: matches.slice(0, MAX_SKILLS_PER_INJECTION),
    skipped: skippedSkills,
    allMetadata,
  };
}

// ============================================
// Output Formatting (Progressive Disclosure)
// ============================================

/**
 * Format skill injection with progressive disclosure
 */
function formatSkillInjection(result) {
  const { triggered, skipped, allMetadata } = result;
  if (triggered.length === 0 && allMetadata.length === 0) return '';

  const lines = [];
  lines.push('<mnemosyne>');

  // Tier 1: Available Skills (metadata only)
  const nonTriggered = allMetadata.filter(
    m => !triggered.some(t => t.path === m._path) && !SESSION_CACHE.has(m._path)
  );

  if (nonTriggered.length > 0) {
    lines.push('## Available Skills (metadata only)\n');
    for (const meta of nonTriggered) {
      const name = meta.name || 'unnamed';
      const desc = meta.description || '';
      const triggers = Array.isArray(meta.triggers) ? meta.triggers.join(', ') : '';
      lines.push(`- ${name}: ${desc}${triggers ? ` (triggers: ${triggers})` : ''}`);
    }
    lines.push('');
  }

  // Tier 2+3: Triggered Skills (full body + resource listing)
  if (triggered.length > 0) {
    lines.push('## Triggered Skills (full body)\n');

    for (const skill of triggered) {
      lines.push(`### ${skill.name} (${skill.scope})`);
      lines.push('');
      lines.push(skill.body);
      lines.push('');

      // Section-level disclosure: show available (not loaded) sections
      if (skill.availableSections && skill.availableSections.length > 0) {
        lines.push(`<!-- More sections available: ${skill.availableSections.map(s => `"${s}"`).join(', ')} -->`);
        lines.push('');
      }

      // Tier 3: Resource listing
      if (skill.resources.length > 0) {
        lines.push(`<!-- Resources available: ${skill.resources.join(', ')} -->`);
        lines.push('');
      }

      // Mark as injected
      SESSION_CACHE.add(skill.path);
    }
  }

  // Skipped skills (ineligible)
  for (const skip of skipped) {
    const hint = skip.installHint ? `. Install: ${skip.installHint}` : '';
    lines.push(`<!-- Skill "${skip.name}" skipped: ${skip.reason}${hint} -->`);
  }

  lines.push('</mnemosyne>');

  return lines.join('\n');
}

// ============================================
// Exports (for testing)
// ============================================
export {
  loadSkillMetadataOnly,
  loadSkillBody,
  loadSkillBodyWithSections,
  parseBodySections,
  listSkillResources,
  checkSkillEligibility,
  findMatchingSkills,
  formatSkillInjection,
  scoreSkillMatch,
  parseSkillFrontmatter,
};

/**
 * Parse skill frontmatter (kept for backward compatibility)
 */
function parseSkillFrontmatter(content) {
  if (!content.startsWith('---')) return null;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return null;

  const frontmatter = content.slice(3, endIndex).trim();
  const template = content.slice(endIndex + 3).trim();

  const metadata = {};
  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    } else if (value.startsWith('"') || value.startsWith("'")) {
      value = value.slice(1, -1);
    }

    metadata[key] = value;
  }

  return { metadata, template };
}

// ============================================
// Main Execution (only when run directly)
// ============================================

const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  const prompt = process.argv.slice(2).join(' ') || process.env.USER_PROMPT || '';

  if (!prompt) {
    process.exit(0);
  }

  const result = findMatchingSkills(prompt);

  if (result.triggered.length > 0 || result.allMetadata.length > 0) {
    const injection = formatSkillInjection(result);
    if (injection) {
      console.log(injection);
    }

    // Track usage of auto-generated skills (fire-and-forget)
    const autoTriggered = result.triggered.filter(
      s => s.metadata && (s.metadata.generated === true || s.metadata.generated === 'true')
    );
    if (autoTriggered.length > 0) {
      setImmediate(async () => {
        try {
          const { getLibBaseUrl } = await import('./utils.js');
          const LIB_BASE = getLibBaseUrl();
          const [memMod, trackerMod, regMod] = await Promise.all([
            import(`${LIB_BASE}memory/MemoryStorage.js`),
            import(`${LIB_BASE}evolution/UsageTracker.js`),
            import(`${LIB_BASE}evolution/GenerationRegistry.js`),
          ]);
          const storage = new memMod.MemoryStorage(PROJECT_DIR);
          const registry = new regMod.GenerationRegistry(storage);
          const tracker = new trackerMod.UsageTracker(storage);

          for (const skill of autoTriggered) {
            const insightId = skill.metadata.insightId;
            if (insightId) {
              const gen = registry.getByName(skill.name);
              if (gen) {
                tracker.recordUsage(gen.id, process.env.SESSION_ID, prompt.slice(0, 200));
              }
            }
          }
          storage.close();
        } catch (e) {
          process.stderr.write(`[Evolution] Usage tracking error: ${e.message}\n`);
        }
      });
    }
  }
}
