import fs from 'node:fs';
import path from 'node:path';

/**
 * Two facts a file check can establish without a model: every number in a report is in its
 * evidence ledger, and an html file has the mechanical accessibility properties a screen reader
 * and a low-vision reader depend on. Style stays with the reviewers; these are facts.
 */
export interface Finding {
  line: number;
  text: string;
}

const NUMBER = /(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?![\w.])/g;

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

/** Numbers as a reader sees them, with the fenced code left out and separators removed for comparison. */
function numbersIn(content: string, skipFences: boolean): Array<Finding & { key: string }> {
  const out: Array<Finding & { key: string }> = [];
  let text = content;
  if (skipFences) text = content.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));
  for (const m of text.matchAll(NUMBER)) {
    const raw = m[0];
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.replace(/^0+/, '').length < 2) continue; // one significant digit is a word, not a figure
    out.push({ line: lineOf(text, m.index ?? 0), text: raw, key: raw.replace(/,/g, '').replace(/%$/, '') });
  }
  return out;
}

/** Every number in `content` must appear in the evidence file (commas and a percent sign do not count). */
export function traceableRule(content: string, evidenceFile: string, root: string): Finding[] | string {
  const full = path.resolve(root, evidenceFile);
  if (!fs.existsSync(full)) return `evidence file missing: ${evidenceFile}`;
  const present = new Set(numbersIn(fs.readFileSync(full, 'utf-8'), false).map((n) => n.key));
  for (const token of fs.readFileSync(full, 'utf-8').split(/[^\d.]+/)) if (token) present.add(token.replace(/\.$/, ''));
  return numbersIn(content, true).filter((n) => !present.has(n.key)).slice(0, 3).map(({ line, text }) => ({ line, text }));
}

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  let rgb: number[];
  if (m) {
    const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const r = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex.trim());
    if (!r) return null;
    rgb = [Number(r[1]), Number(r[2]), Number(r[3])];
  }
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** CSS rules that set both a text colour and a background: the pair must reach 4.5:1. */
function contrastFindings(css: string, offset: number, whole: string): Finding[] {
  const out: Finding[] = [];
  const rule = /\{([^{}]*)\}/g;
  for (const m of css.matchAll(rule)) {
    const body = m[1] ?? '';
    const fg = /(?:^|;|\s)color\s*:\s*([^;]+)/i.exec(body)?.[1];
    const bg = /background(?:-color)?\s*:\s*([^;]+)/i.exec(body)?.[1];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg.split(/\s+/)[0] ?? bg);
    if (ratio !== null && ratio < 4.5) out.push({ line: lineOf(whole, offset + (m.index ?? 0)), text: `contrast ${ratio.toFixed(2)}:1 for color ${fg.trim()} on ${bg.trim()}` });
  }
  return out;
}

const TAG = (name: string): RegExp => new RegExp(`<${name}\\b([^>]*)>`, 'gi');

function unnamed(html: string, tag: string): Finding[] {
  const out: Finding[] = [];
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'gi');
  for (const m of html.matchAll(re)) {
    const attrs = m[1] ?? '';
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').trim();
    if (!text && !/aria-label(?:ledby)?\s*=/i.test(attrs)) out.push({ line: lineOf(html, m.index ?? 0), text: `<${tag}> without text or aria-label` });
  }
  return out;
}

export function a11yRule(content: string, file: string): Finding[] {
  const out: Finding[] = [];
  if (/\.css$/i.test(file)) return contrastFindings(content, 0, content);
  for (const m of content.matchAll(TAG('img'))) if (!/\balt\s*=/i.test(m[1] ?? '')) out.push({ line: lineOf(content, m.index ?? 0), text: '<img> without alt' });
  let last = 0;
  for (const m of content.matchAll(/<h([1-6])\b/gi)) {
    const level = Number(m[1]);
    if (last && level > last + 1) out.push({ line: lineOf(content, m.index ?? 0), text: `heading skips from h${last} to h${level}` });
    last = level;
  }
  out.push(...unnamed(content, 'button'), ...unnamed(content, 'a'));
  const labelled = new Set([...content.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));
  for (const m of content.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const attrs = m[2] ?? '';
    if (/type\s*=\s*["']?(hidden|submit|button)/i.test(attrs)) continue;
    const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!(id && labelled.has(id)) && !/aria-label(?:ledby)?\s*=/i.test(attrs)) out.push({ line: lineOf(content, m.index ?? 0), text: `<${m[1]}> without a label` });
  }
  for (const m of content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out.push(...contrastFindings(m[1] ?? '', (m.index ?? 0) + m[0].indexOf(m[1] ?? ''), content));
  return out.sort((a, b) => a.line - b.line).slice(0, 3);
}
