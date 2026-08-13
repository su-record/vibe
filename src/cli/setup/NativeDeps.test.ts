/**
 * 실측에서 나온 사건을 고정한다.
 *
 * npm 12.0.2 / 전역 설치본에서:
 *   node_modules/better-sqlite3/           ← 소스는 있고
 *   node_modules/better-sqlite3/build/     ← 산출물은 없다
 *   npm rebuild better-sqlite3             ← "rebuilt successfully" 를 찍고도 안 만든다
 *                                             (allowScripts 가 install 스크립트를 차단)
 *   node node_modules/prebuild-install/bin.js  ← 이건 만든다
 *
 * 판정 기준은 종료 코드가 아니라 **산출물 존재**다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { missingNativeDeps, repairNativeDeps, nativeDepHint } from './NativeDeps.js';

let root: string;

const DEP = path.join('node_modules', 'better-sqlite3');
const ARTIFACT = path.join(DEP, 'build', 'Release', 'better_sqlite3.node');

const mk = (rel: string, body = ''): void => {
  fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), body);
};

/** prebuild-install 대역 — 실제 바이너리를 받는 대신 산출물만 만든다 */
const fakePrebuild = (succeeds: boolean): void => {
  const body = succeeds
    ? `const fs=require('fs'),p=require('path');
       const out=p.join(process.cwd(),'build','Release');
       fs.mkdirSync(out,{recursive:true});
       fs.writeFileSync(p.join(out,'better_sqlite3.node'),'');`
    : 'process.exit(1);';
  mk(path.join('node_modules', 'prebuild-install', 'bin.js'), body);
};

beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-native-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('missingNativeDeps', () => {
  it('패키지가 아예 없으면 누락이 아니다 — 미설치와 미빌드는 다른 사건이다', () => {
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    expect(missingNativeDeps(root)).toEqual([]);
  });

  it('소스만 있고 산출물이 없으면 누락이다 — allowScripts 차단이 만드는 상태', () => {
    mk(path.join(DEP, 'package.json'), '{}');
    expect(missingNativeDeps(root)).toEqual(['better-sqlite3']);
  });

  it('산출물이 있으면 누락이 아니다', () => {
    mk(path.join(DEP, 'package.json'), '{}');
    mk(ARTIFACT);
    expect(missingNativeDeps(root)).toEqual([]);
  });
});

describe('repairNativeDeps', () => {
  it('prebuild-install 을 직접 실행해 산출물을 만든다', () => {
    mk(path.join(DEP, 'package.json'), '{}');
    fakePrebuild(true);

    expect(repairNativeDeps(root)).toEqual({ repaired: ['better-sqlite3'], failed: [] });
    expect(fs.existsSync(path.join(root, ARTIFACT))).toBe(true);
  });

  it('prebuild-install 이 없으면 실패로 보고한다 — 조용히 넘기지 않는다', () => {
    mk(path.join(DEP, 'package.json'), '{}');
    expect(repairNativeDeps(root)).toEqual({ repaired: [], failed: ['better-sqlite3'] });
  });

  it('실행이 실패하면 실패로 보고한다', () => {
    mk(path.join(DEP, 'package.json'), '{}');
    fakePrebuild(false);
    expect(repairNativeDeps(root)).toEqual({ repaired: [], failed: ['better-sqlite3'] });
  });

  it('복구할 것이 없으면 아무것도 실행하지 않는다', () => {
    mk(path.join(DEP, 'package.json'), '{}');
    mk(ARTIFACT);
    fakePrebuild(false);   // 실행되면 실패로 잡힌다
    expect(repairNativeDeps(root)).toEqual({ repaired: [], failed: [] });
  });
});

describe('nativeDepHint', () => {
  it('npm 정책을 푸는 명령을 안내한다 — 차단이 근본 원인이다', () => {
    expect(nativeDepHint(['better-sqlite3'])).toContain('npm install-scripts approve better-sqlite3');
  });
});
