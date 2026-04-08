/**
 * Stop Hook - 개발일지 자동 생성
 *
 * 매 커밋 후 카운터를 확인하여 interval(기본 10)에 도달하면
 * LLM을 통해 개발일지를 생성하고 설정된 블로그 레포에 저장합니다.
 *
 * Config: .claude/vibe/config.json → devlog 섹션
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, readProjectConfig } from './utils.js';

const DEFAULTS = {
  targetDir: 'posts',
  prefix: 'devlog',
  interval: 10,
  autoPush: false,
  lang: 'ko',
  category: 'dev-log',
  tags: [],
};

function getDevlogConfig() {
  const config = readProjectConfig();
  const devlog = config.devlog;
  if (!devlog || !devlog.enabled) return null;
  if (!devlog.targetRepo) return null;
  return { ...DEFAULTS, ...devlog };
}

function getProjectName() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'package.json'), 'utf-8'));
    return pkg.name || path.basename(PROJECT_DIR);
  } catch {
    return path.basename(PROJECT_DIR);
  }
}

function getGitAuthor() {
  try {
    return execSync('git config user.name', { cwd: PROJECT_DIR, encoding: 'utf-8' }).trim();
  } catch {
    return 'Unknown';
  }
}

function findLastDevlogNumber(config) {
  const dir = path.join(config.targetRepo, config.targetDir);
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith(config.prefix + '-') && f.endsWith('.md'))
    .sort();

  if (files.length === 0) return 0;

  const last = files[files.length - 1];
  const match = last.match(new RegExp(`${config.prefix}-(\\d+)\\.md$`));
  return match ? parseInt(match[1], 10) : 0;
}

function findLastDevlogDate(config) {
  const num = findLastDevlogNumber(config);
  if (num === 0) return null;

  const padded = String(num).padStart(4, '0');
  const filePath = path.join(config.targetRepo, config.targetDir, `${config.prefix}-${padded}.md`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const dateMatch = content.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
    return dateMatch ? dateMatch[1] : null;
  } catch {
    return null;
  }
}

function countCommitsSinceLastDevlog(config) {
  const lastDate = findLastDevlogDate(config);
  try {
    const args = lastDate ? `--after="${lastDate}"` : '';
    const log = execSync(`git log --oneline ${args}`, {
      cwd: PROJECT_DIR,
      encoding: 'utf-8',
    }).trim();
    return log ? log.split('\n').length : 0;
  } catch {
    return 0;
  }
}

function getCommitsSinceLastDevlog(config) {
  const lastDate = findLastDevlogDate(config);
  const args = lastDate ? `--after="${lastDate}"` : '';
  try {
    return execSync(
      `git log --oneline --reverse --format="%h %ad %s" --date=short ${args}`,
      { cwd: PROJECT_DIR, encoding: 'utf-8' }
    ).trim();
  } catch {
    return '';
  }
}

function generateDevlogContent(config, commits, nextNumber) {
  const projectName = getProjectName();
  const author = config.author || getGitAuthor();
  const today = new Date().toISOString().slice(0, 10);
  const padded = String(nextNumber).padStart(4, '0');

  const lines = commits.split('\n').filter(Boolean);
  const interval = Math.min(lines.length, config.interval);

  // 이번 배치의 커밋만 (최대 interval개)
  const batch = lines.slice(0, interval);
  const dates = batch.map(l => l.split(' ')[1]).filter(Boolean);
  const startDate = dates[0] || today;
  const endDate = dates[dates.length - 1] || today;

  // 버전 범프 감지
  const versions = batch
    .map(l => l.split(' ').slice(2).join(' '))
    .filter(msg => /^\d+\.\d+/.test(msg));
  const startVersion = versions[0] || '';
  const endVersion = versions[versions.length - 1] || '';

  // 의미 있는 커밋 분류
  const meaningful = batch
    .map(l => {
      const parts = l.split(' ');
      return { hash: parts[0], date: parts[1], msg: parts.slice(2).join(' ') };
    })
    .filter(c => !/^\d+\.\d+/.test(c.msg)); // 버전 범프 제외

  // 커밋 테이블 생성
  const commitTable = meaningful.slice(0, 8).map(c => {
    const shortMsg = c.msg.length > 60 ? c.msg.slice(0, 57) + '...' : c.msg;
    return `| \`${shortMsg}\` | |`;
  }).join('\n');

  const versionInfo = startVersion && endVersion
    ? `- **버전**: ${startVersion} → ${endVersion}`
    : '';

  return `---
title: "${projectName} 개발일지 #${nextNumber} - (${interval}개 커밋)"
date: "${today}"
category: "${config.category}"
description: ""
tags: [${[projectName, ...config.tags].map(t => `"${t}"`).join(', ')}]
author: "${author}"
lang: "${config.lang}"
---

# ${projectName} 개발일지 #${nextNumber}

**작업 기간**: ${startDate}${startDate !== endDate ? ` ~ ${endDate}` : ''}

## 이번 기간 작업 내용

### ${interval}개 커밋

| 커밋 | 내용 |
|------|------|
${commitTable}

## 개발 현황

${versionInfo}

---

**다음 개발일지**: ${config.prefix}-${String(nextNumber + 1).padStart(4, '0')} (다음 ${config.interval}개 커밋 후)
`;
}

function writeDevlog(config, content, nextNumber) {
  const padded = String(nextNumber).padStart(4, '0');
  const targetDir = path.join(config.targetRepo, config.targetDir);
  const filePath = path.join(targetDir, `${config.prefix}-${padded}.md`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`[DEVLOG] Generated: ${filePath}`);

  if (config.autoPush) {
    try {
      const relPath = path.join(config.targetDir, `${config.prefix}-${padded}.md`);
      execSync(`git add "${relPath}"`, { cwd: config.targetRepo, stdio: 'ignore' });
      execSync(`git commit -m "post: Add ${config.prefix} #${nextNumber}"`, {
        cwd: config.targetRepo,
        stdio: 'ignore',
      });
      execSync('git push', { cwd: config.targetRepo, stdio: 'ignore' });
      console.log(`[DEVLOG] Pushed to ${config.targetRepo}`);
    } catch (e) {
      console.error(`[DEVLOG] Push failed: ${e.message}`);
    }
  }
}

try {
  const config = getDevlogConfig();
  if (!config) process.exit(0);

  if (!fs.existsSync(config.targetRepo)) {
    console.error(`[DEVLOG] targetRepo not found: ${config.targetRepo}`);
    process.exit(0);
  }

  const commitCount = countCommitsSinceLastDevlog(config);
  if (commitCount < config.interval) {
    process.exit(0);
  }

  const nextNumber = findLastDevlogNumber(config) + 1;
  const commits = getCommitsSinceLastDevlog(config);

  if (!commits) process.exit(0);

  const content = generateDevlogContent(config, commits, nextNumber);
  writeDevlog(config, content, nextNumber);
} catch {
  // devlog generation failure should never block
}
