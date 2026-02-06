/**
 * 패키지 설치 시 프로젝트 .npmrc(스코프+토큰)를 전역 ~/.npmrc에 적용
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const SCOPE_LINE = '@su-record:registry=https://npm.pkg.github.com';
const AUTH_KEY = '//npm.pkg.github.com/:_authToken';

function getUserNpmrcPath(): string {
  return path.join(os.homedir(), '.npmrc');
}

function hasScopeLine(content: string): boolean {
  const n = content.replace(/\r\n/g, '\n');
  return n.split('\n').some(line => line.trim().startsWith('@su-record:registry='));
}

function hasAuthLine(content: string): boolean {
  const n = content.replace(/\r\n/g, '\n');
  return n.split('\n').some(line => line.trim().startsWith(AUTH_KEY + '='));
}

function readTokenFromFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    const n = content.replace(/\r\n/g, '\n');
    for (const line of n.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith(AUTH_KEY + '=')) {
        const value = trimmed.slice(AUTH_KEY.length + 1).trim();
        return value || null;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function getTokenFromPackageRoot(packageRoot: string): string | null {
  const fromNpmrc = readTokenFromFile(path.join(packageRoot, '.npmrc'));
  if (fromNpmrc != null) return fromNpmrc;
  return readTokenFromFile(path.join(packageRoot, 'npmrc.default'));
}

/**
 * ~/.npmrc에 스코프 + 토큰 추가. 이미 있으면 스킵.
 * 토큰: packageRoot/.npmrc > process.env.GITHUB_TOKEN > ${GITHUB_TOKEN}
 */
export function applyNpmrcScope(packageRoot: string): void {
  const npmrcPath = getUserNpmrcPath();
  let content = '';
  try {
    if (fs.existsSync(npmrcPath)) {
      content = fs.readFileSync(npmrcPath, 'utf-8');
    }
  } catch {
    return;
  }

  let token = getTokenFromPackageRoot(packageRoot);
  if (token == null || token === '${GITHUB_TOKEN}') {
    token = process.env.GITHUB_TOKEN ?? '${GITHUB_TOKEN}';
  }
  const authLine = `${AUTH_KEY}=${token}`;

  const toAppend: string[] = [];
  if (!hasScopeLine(content)) toAppend.push(SCOPE_LINE);
  if (!hasAuthLine(content)) toAppend.push(authLine);

  if (toAppend.length === 0) return;

  const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  try {
    fs.appendFileSync(npmrcPath, prefix + toAppend.join('\n') + '\n');
  } catch {
    // 권한 등 실패해도 설치는 계속
  }
}
