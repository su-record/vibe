#!/usr/bin/env node
/**
 * Skill Injector
 * Trigger-based skill injection on UserPromptSubmit
 *
 * Inspired by oh-my-claudecode's skill-injector.mjs
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { VIBE_PATH, PROJECT_DIR } from './utils.js';

// Skill storage locations
const USER_SKILLS_DIR = path.join(os.homedir(), '.claude', 'vibe', 'skills');
const PROJECT_SKILLS_DIR = path.join(PROJECT_DIR, '.claude', 'vibe', 'skills');

// Session cache to prevent re-injection
const SESSION_CACHE = new Set();

// Max skills per injection
const MAX_SKILLS_PER_INJECTION = 5;

/**
 * Parse skill frontmatter
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

    // Parse arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    } else if (value.startsWith('"') || value.startsWith("'")) {
      value = value.slice(1, -1);
    }

    metadata[key] = value;
  }

  return { metadata, template };
}

/**
 * Find all skill files
 */
function findSkillFiles() {
  const skills = [];

  // Project skills (higher priority)
  if (fs.existsSync(PROJECT_SKILLS_DIR)) {
    const projectSkills = fs.readdirSync(PROJECT_SKILLS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => ({ path: path.join(PROJECT_SKILLS_DIR, f), scope: 'project' }));
    skills.push(...projectSkills);
  }

  // User skills
  if (fs.existsSync(USER_SKILLS_DIR)) {
    const userSkills = fs.readdirSync(USER_SKILLS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => ({ path: path.join(USER_SKILLS_DIR, f), scope: 'user' }));
    skills.push(...userSkills);
  }

  return skills;
}

/**
 * Score skill match against prompt
 */
function scoreSkillMatch(triggers, prompt) {
  if (!triggers || triggers.length === 0) return 0;

  const lowerPrompt = prompt.toLowerCase();
  let score = 0;

  for (const trigger of triggers) {
    const lowerTrigger = trigger.toLowerCase();
    if (lowerPrompt.includes(lowerTrigger)) {
      score += 10; // Base score per match
      // Bonus for word boundary match
      const regex = new RegExp(`\\b${lowerTrigger}\\b`, 'i');
      if (regex.test(prompt)) {
        score += 5;
      }
    }
  }

  return score;
}

/**
 * Find matching skills for prompt
 */
function findMatchingSkills(prompt) {
  const skillFiles = findSkillFiles();
  const matches = [];

  for (const { path: skillPath, scope } of skillFiles) {
    // Check session cache
    const cacheKey = `${skillPath}`;
    if (SESSION_CACHE.has(cacheKey)) continue;

    try {
      const content = fs.readFileSync(skillPath, 'utf8');
      const parsed = parseSkillFrontmatter(content);

      if (!parsed) continue;

      const triggers = parsed.metadata.triggers || [];
      const score = scoreSkillMatch(triggers, prompt);

      if (score > 0) {
        matches.push({
          path: skillPath,
          name: parsed.metadata.name || path.basename(skillPath, '.md'),
          score,
          scope,
          template: parsed.template,
          metadata: parsed.metadata,
        });
      }
    } catch (err) {
      // Skip unreadable files
    }
  }

  // Sort by score (descending) and scope (project > user)
  matches.sort((a, b) => {
    if (a.scope !== b.scope) {
      return a.scope === 'project' ? -1 : 1;
    }
    return b.score - a.score;
  });

  return matches.slice(0, MAX_SKILLS_PER_INJECTION);
}

/**
 * Format skill injection
 */
function formatSkillInjection(skills) {
  if (skills.length === 0) return '';

  const lines = [];
  lines.push('<mnemosyne>');
  lines.push('## Injected Skills\n');

  for (const skill of skills) {
    lines.push(`### ${skill.name} (${skill.scope})`);
    lines.push('');
    lines.push(skill.template);
    lines.push('');

    // Mark as injected
    SESSION_CACHE.add(skill.path);
  }

  lines.push('</mnemosyne>');

  return lines.join('\n');
}

/**
 * Main execution
 */
const prompt = process.argv.slice(2).join(' ') || process.env.USER_PROMPT || '';

if (!prompt) {
  // No prompt, exit silently
  process.exit(0);
}

const matchingSkills = findMatchingSkills(prompt);

if (matchingSkills.length > 0) {
  const injection = formatSkillInjection(matchingSkills);
  console.log(injection);
}
