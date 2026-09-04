import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

/**
 * PDF text. `pdftotext` (poppler) when the machine has it — it handles fonts and layout; otherwise
 * a best-effort reader of the text operators in FlateDecode/plain content streams. The method
 * used is reported, because the two differ in quality and the model should know which it got.
 */
export interface PdfText {
  method: 'pdftotext' | 'builtin';
  pages: string[];
}

function viaPdftotext(file: string): string[] | null {
  const r = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf-8', timeout: 60_000 });
  if (r.status !== 0) return null;
  return r.stdout.split('\f').map((p) => p.trimEnd()).filter((p, i, all) => p.trim() || i < all.length - 1);
}

function pdfString(raw: string): string {
  return raw.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, e: string) => {
    if (e === 'n') return '\n';
    if (e === 'r') return '';
    if (e === 't') return '\t';
    if (e === 'b' || e === 'f') return '';
    if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
    return e;
  });
}

/** Text operators inside one content stream: Tj · TJ · ' · " and line moves. */
function textFromStream(content: string): string {
  let out = '';
  const re = /\((?:\\.|[^\\)])*\)\s*(Tj|'|")|\[((?:[^\]\\]|\\.)*)\]\s*TJ|(T\*|Td|TD|Tm)(?![A-Za-z])/g;
  for (const m of content.matchAll(re)) {
    if (m[1]) {
      const literal = /\(((?:\\.|[^\\)])*)\)/.exec(m[0])?.[1] ?? '';
      out += (m[1] === "'" || m[1] === '"' ? '\n' : '') + pdfString(literal);
    } else if (m[2] !== undefined) {
      for (const s of m[2].matchAll(/\(((?:\\.|[^\\)])*)\)|(-?\d+(?:\.\d+)?)/g)) {
        if (s[1] !== undefined) out += pdfString(s[1]);
        else if (Number(s[2]) < -200) out += ' ';
      }
    } else if (m[3]) out += m[3] === 'Tm' ? '' : '\n';
  }
  return out;
}

function builtin(buf: Buffer): string[] {
  const latin = buf.toString('latin1');
  const pages: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let current = '';
  for (const m of latin.matchAll(re)) {
    const head = latin.slice(Math.max(0, m.index! - 400), m.index!);
    let content: string;
    try {
      content = /\/FlateDecode/.test(head) ? zlib.inflateSync(Buffer.from(m[1]!, 'latin1')).toString('latin1') : m[1]!;
    } catch {
      continue;
    }
    if (!/\bBT\b/.test(content)) continue;
    const text = textFromStream(content).replace(/[ \t]+\n/g, '\n').trim();
    if (text) current += (current ? '\n' : '') + text;
    pages.push(current);
    current = '';
  }
  return pages.filter(Boolean);
}

export function readPdf(file: string, buf: Buffer): PdfText {
  const external = viaPdftotext(file);
  if (external) return { method: 'pdftotext', pages: external };
  return { method: 'builtin', pages: builtin(buf) };
}
