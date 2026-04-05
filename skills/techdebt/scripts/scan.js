#!/usr/bin/env node
/**
 * techdebt/scripts/scan.js
 * Scan a directory for technical debt patterns.
 * Usage: node scan.js <directory>
 * Output: JSON array of findings to stdout.
 */

import fs from 'fs';
import path from 'path';

const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** @returns {string[]} */
function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full));
    else if (TARGET_EXTENSIONS.has(path.extname(entry.name))) results.push(full);
  }
  return results;
}

/** @param {string} file @returns {import('./scan.js').Finding[]} */
function scanFile(file) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const findings = [];
  let functionLineStart = -1;
  let braceDepth = 0;
  let functionLineCount = 0;
  let maxNesting = 0;
  let currentNesting = 0;

  const push = (line, type, severity, message) =>
    findings.push({ file, line: line + 1, type, severity, message });

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (/:\s*any\b|as\s+any\b/.test(trimmed)) push(i, 'any-type', 'P1', `'any' type usage detected`);
    if (/console\.(log|warn|error|debug)\s*\(/.test(trimmed)) push(i, 'console-log', 'P2', `console statement found`);
    if (/^import\s+/.test(trimmed)) {
      const match = trimmed.match(/^import\s+\{([^}]+)\}/);
      if (match) {
        const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop());
        for (const name of names) {
          const usedElsewhere = lines.slice(i + 1).some(l => new RegExp(`\\b${name}\\b`).test(l));
          if (!usedElsewhere) push(i, 'unused-import', 'P2', `Possibly unused import: ${name}`);
        }
      }
    }
    const magicNumber = trimmed.match(/(?<![A-Za-z_$'"`])\b([2-9]\d{2,}|\d{4,})\b(?![A-Za-z_$'"`])/);
    if (magicNumber && !/^\s*(\/\/|\/\*)/.test(raw)) push(i, 'magic-number', 'P3', `Magic number: ${magicNumber[1]}`);

    const opens = (raw.match(/\{/g) || []).length;
    const closes = (raw.match(/\}/g) || []).length;
    if (/\bfunction\b|\=\>/.test(raw) && opens > closes) {
      functionLineStart = i;
      functionLineCount = 0;
      braceDepth = opens - closes;
    } else if (functionLineStart >= 0) {
      braceDepth += opens - closes;
      functionLineCount++;
      if (braceDepth <= 0) {
        if (functionLineCount > 50) push(functionLineStart, 'long-function', 'P2', `Function is ${functionLineCount} lines (limit: 50)`);
        functionLineStart = -1;
      }
    }

    const indent = raw.match(/^(\s*)/)[1].length;
    currentNesting = Math.floor(indent / 2);
    if (currentNesting > maxNesting) maxNesting = currentNesting;
    if (currentNesting > 4) push(i, 'deep-nesting', 'P2', `Nesting depth ${currentNesting} exceeds limit of 4`);
  }

  return findings;
}

const dir = process.argv[2] || process.cwd();
if (!fs.existsSync(dir)) {
  process.stderr.write(`Directory not found: ${dir}\n`);
  process.exit(1);
}

const files = collectFiles(path.resolve(dir));
const findings = files.flatMap(scanFile);
process.stdout.write(JSON.stringify(findings, null, 2) + '\n');
