import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

/** 임시 파일 → rename. 읽는 쪽이 반쯤 쓰인 파일을 보지 않는다. */
export function writeAtomic(file: string, text: string): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text, 'utf-8');
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string): T | null {
  const text = readText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function writeJson(file: string, value: unknown): void {
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function appendJsonl(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf-8');
}

export function readJsonl<T>(file: string): T[] {
  const text = readText(file);
  if (text === null) return [];
  const out: T[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // 깨진 줄은 건너뛴다 — append 중 크래시의 흔적
    }
  }
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}
