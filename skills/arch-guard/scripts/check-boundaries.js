#!/usr/bin/env node
/**
 * arch-guard/scripts/check-boundaries.js
 * Read arch-rules.json and scan imports for violations.
 * Usage: node check-boundaries.js [arch-rules.json] [src-dir]
 * Output: JSON array of violations to stdout.
 */

import fs from 'fs';
import path from 'path';

const IMPORT_RE = /(?:import|from|require)\s*\(?['"]([^'"]+)['"]\)?/g;
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** @returns {string[]} */
function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full));
    else if (CODE_EXTS.has(path.extname(entry.name))) results.push(full);
  }
  return results;
}

/** @param {string} pattern @param {string} filePath @returns {boolean} */
function matchesGlob(pattern, filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const regexStr = pattern
    .replace(/\\/g, '/')
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '__DOUBLE__')
    .replace(/\*/g, '[^/]+')
    .replace(/__DOUBLE__/g, '.+');
  return new RegExp(`^${regexStr}$`).test(normalized);
}

/** @param {string} file @returns {string[]} */
function extractImports(file) {
  const content = fs.readFileSync(file, 'utf-8');
  const imports = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content)) !== null) imports.push(m[1]);
  return imports;
}

/** @param {string} fromFile @param {string} imp @param {string} baseDir @returns {string} */
function resolveImport(fromFile, imp, baseDir) {
  if (!imp.startsWith('.')) return imp;
  return path.resolve(path.dirname(fromFile), imp).replace(baseDir + path.sep, '').replace(/\\/g, '/');
}

const rulesPath = process.argv[2] || '.claude/vibe/arch-rules.json';
const srcDir = path.resolve(process.argv[3] || 'src');
const baseDir = path.resolve('.');

if (!fs.existsSync(rulesPath)) {
  process.stderr.write(`arch-rules.json not found: ${rulesPath}\n`);
  process.exit(1);
}

const { rules } = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
const files = collectFiles(srcDir);
const violations = [];

for (const rule of rules) {
  const fromFiles = files.filter(f => matchesGlob(rule.from, f.replace(baseDir + path.sep, '').replace(/\\/g, '/')));
  for (const file of fromFiles) {
    const imports = extractImports(file);
    for (const imp of imports) {
      const resolved = resolveImport(file, imp, baseDir);
      const forbidden = (rule.cannotImport || []).some(pat => matchesGlob(pat, resolved) || resolved.includes(pat.replace('/**', '').replace('**/', '')));
      if (forbidden) {
        violations.push({
          rule: rule.name,
          file: file.replace(baseDir + path.sep, '').replace(/\\/g, '/'),
          import: imp,
          resolved,
          reason: rule.reason || `Violates rule: ${rule.name}`,
        });
      }
    }
  }
}

process.stdout.write(JSON.stringify(violations, null, 2) + '\n');
if (violations.length > 0) process.exit(1);
