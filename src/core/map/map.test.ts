import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blast, buildMap, callersOf, symbolsOf } from './index.js';
import { symbolsOfFile } from './symbols.js';

let root: string;

/** A fixture tree in ts, py and go: a defining symbol, a caller reached through an import edge, and a caller that only matches by name. */
function writeFixture(base: string): void {
  fs.mkdirSync(path.join(base, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(base, 'src', 'a.ts'),
    ['export class Greeter {', '  greet(name: string): string {', "    return 'hi ' + name;", '  }', '}', '', 'export function greet(name: string): string {', "  return 'hello ' + name;", '}', '', 'export const salute = 1;', ''].join('\n'),
  );
  fs.writeFileSync(path.join(base, 'src', 'b.ts'), ["import { greet } from './a.js';", '', 'export function hello(): string {', '  return greet(\'b\');', '}', ''].join('\n'));
  fs.writeFileSync(path.join(base, 'src', 'c.ts'), ['export function unrelated(): string {', "  return greet('c'); // calls it by name, no import", '}', ''].join('\n'));
  fs.mkdirSync(path.join(base, 'src', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(base, 'src', 'pkg', 'util.py'), ['def helper(x):', '    return x + 1', '', '', 'class Widget:', '    def spin(self):', '        return helper(1)', ''].join('\n'));
  fs.writeFileSync(path.join(base, 'src', 'pkg', 'main.py'), ['from .util import helper', '', '', 'def run():', '    return helper(2)', ''].join('\n'));
  fs.mkdirSync(path.join(base, 'gomod', 'pkg'), { recursive: true });
  fs.mkdirSync(path.join(base, 'gomod', 'cmd'), { recursive: true });
  fs.writeFileSync(path.join(base, 'gomod', 'go.mod'), 'module example.com/app\n\ngo 1.21\n');
  fs.writeFileSync(path.join(base, 'gomod', 'pkg', 'lib.go'), ['package pkg', '', 'func Greet(name string) string {', '\treturn "hi " + name', '}', ''].join('\n'));
  fs.writeFileSync(path.join(base, 'gomod', 'cmd', 'main.go'), ['package main', '', 'import "example.com/app/pkg"', '', 'func main() {', '\tpkg.Greet("world")', '}', ''].join('\n'));
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-map-'));
  writeFixture(root);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('symbols — functions, classes, methods and exports per language', () => {
  it('ts: a class with its method, a top-level function and an export, each with a one-line signature and line range', () => {
    const symbols = symbolsOf(root, 'src/a.ts');
    const cls = symbols.find((s) => s.name === 'Greeter');
    expect(cls).toMatchObject({ kind: 'class', startLine: 1, endLine: 5, exported: true });
    const method = symbols.find((s) => s.name === 'greet' && s.kind === 'method');
    expect(method).toMatchObject({ startLine: 2, endLine: 4, signature: "greet(name: string): string" });
    const fn = symbols.find((s) => s.name === 'greet' && s.kind === 'function');
    expect(fn).toMatchObject({ startLine: 7, endLine: 9, exported: true });
    const value = symbols.find((s) => s.name === 'salute');
    expect(value).toMatchObject({ kind: 'export', startLine: 11, endLine: 11 });
  });

  it('py: def and class, indentation-delimited, exported by name (no leading underscore)', () => {
    const symbols = symbolsOf(root, 'src/pkg/util.py');
    expect(symbols.find((s) => s.name === 'helper')).toMatchObject({ kind: 'function', startLine: 1, endLine: 2, exported: true });
    expect(symbols.find((s) => s.name === 'Widget')).toMatchObject({ kind: 'class', startLine: 5, endLine: 7 });
    expect(symbols.find((s) => s.name === 'spin')).toMatchObject({ kind: 'method', startLine: 6, endLine: 7 });
  });

  it('go: a function is a symbol exported by capitalisation, a type struct is a class', () => {
    const symbols = symbolsOfFile(path.join(root, 'gomod', 'pkg', 'lib.go'), fs.readFileSync(path.join(root, 'gomod', 'pkg', 'lib.go'), 'utf-8'));
    expect(symbols.find((s) => s.name === 'Greet')).toMatchObject({ kind: 'function', startLine: 3, endLine: 5, exported: true });
  });
});

describe('imports — edges across ts, python and go', () => {
  it('resolves a relative TS import (.js read as .ts), a Python relative import, and a Go module-relative import through go.mod', () => {
    const { map } = buildMap(root, '.');
    expect(map.files['src/b.ts']?.imports).toContain('src/a.ts');
    expect(map.files['src/pkg/main.py']?.imports).toContain('src/pkg/util.py');
    expect(map.files['gomod/cmd/main.go']?.imports).toContain('gomod/pkg/lib.go');
  });
});

describe('callers — marked import when the edge is confirmed, name when it is not', () => {
  it('ts: b.ts imports and calls greet (import); c.ts calls it by name alone with no import (name)', () => {
    buildMap(root, '.');
    const callers = callersOf(root, 'greet', 1);
    expect(callers).toContainEqual({ file: 'src/b.ts', confidence: 'import' });
    expect(callers).toContainEqual({ file: 'src/c.ts', confidence: 'name' });
  });

  it('py and go: the importer that calls the symbol is marked import', () => {
    buildMap(root, '.');
    expect(callersOf(root, 'helper', 1)).toContainEqual({ file: 'src/pkg/main.py', confidence: 'import' });
    expect(callersOf(root, 'Greet', 1)).toContainEqual({ file: 'gomod/cmd/main.go', confidence: 'import' });
  });

  it('an unknown symbol has no callers', () => {
    buildMap(root, '.');
    expect(callersOf(root, 'nothingCallsThis', 2)).toEqual([]);
  });
});

describe('blast — the working tree\'s changed symbols and their callers', () => {
  it('follows a changed symbol two hops in a temporary git repository', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-map-blast-'));
    const g = (...args: string[]): string => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    g('init', '-q');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'base.ts'), ['export function core(): number {', '  return 1;', '}', ''].join('\n'));
    fs.writeFileSync(path.join(repo, 'src', 'mid.ts'), ["import { core } from './base.js';", '', 'export function wrap(): number {', '  return core();', '}', ''].join('\n'));
    fs.writeFileSync(path.join(repo, 'src', 'top.ts'), ["import { wrap } from './mid.js';", '', 'export function useIt(): number {', '  return wrap();', '}', ''].join('\n'));
    g('add', '.');
    g('commit', '-q', '-m', 'base');
    fs.writeFileSync(path.join(repo, 'src', 'base.ts'), ['export function core(): number {', '  return 2;', '}', ''].join('\n'));
    try {
      const result = blast(repo, 2, 'src');
      expect(result.changed).toContainEqual(expect.objectContaining({ file: 'src/base.ts', name: 'core' }));
      const files = result.callers.map((c) => c.file);
      expect(files).toContain('src/mid.ts');
      expect(files).toContain('src/top.ts');
      expect(result.callers.find((c) => c.file === 'src/mid.ts')?.confidence).toBe('import');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('cache — .vibe/cache/map.json, refreshed only when a file\'s content hash changed', () => {
  it('a warm second build re-reads only the file that changed', () => {
    const first = buildMap(root, 'src');
    expect(first.refreshed.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(root, '.vibe', 'cache', 'map.json'))).toBe(true);
    const before = first.map.files['src/a.ts']?.hash;
    fs.appendFileSync(path.join(root, 'src', 'c.ts'), '\n// touched\n');
    const second = buildMap(root, 'src');
    expect(second.refreshed).toEqual(['src/c.ts']);
    expect(second.map.files['src/a.ts']?.hash).toBe(before);
  });
});
