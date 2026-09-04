import zlib from 'node:zlib';
import { readZip } from './zip.js';
import { bodies, textOf } from './xml.js';
import { readCfb } from './cfb.js';

/**
 * Hangul word processor files. HWPX (2010+, OWPML) is zip + XML like docx. HWP 5.0 is an OLE
 * file whose BodyText/Section streams are raw-deflated records; paragraph text (tag 67) is UTF-16
 * with control characters — inline controls take 8 bytes, 13 ends a paragraph, 10 breaks a line.
 */
export function readHwpx(buf: Buffer): string[] {
  const zip = readZip(buf);
  const sections = [...zip.keys()].filter((k) => /^Contents\/section\d+\.xml$/.test(k)).sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
  const out: string[] = [];
  for (const file of sections) {
    const xml = zip.get(file)!.toString('utf-8');
    for (const p of bodies(xml, 'hp:p')) {
      const text = textOf(p, 'hp:t').trim();
      if (text) out.push(text);
    }
  }
  return out;
}

const PARA_TEXT = 67;
const EXTENDED = new Set([1, 2, 3, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23]);
const INLINE = new Set([4, 5, 6, 7, 8, 9, 19, 20]);

function paragraphText(data: Buffer): string {
  let text = '';
  for (let i = 0; i + 1 < data.length; ) {
    const code = data.readUInt16LE(i);
    if (code === 13) break;
    if (code === 10) {
      text += '\n';
      i += 2;
    } else if (code === 9) {
      text += '\t';
      i += 2;
    } else if (EXTENDED.has(code) || INLINE.has(code)) {
      i += 16; // control + 7 more code units
    } else if (code < 32) {
      i += 2;
    } else {
      text += String.fromCharCode(code);
      i += 2;
    }
  }
  return text;
}

function sectionParagraphs(raw: Buffer): string[] {
  const out: string[] = [];
  for (let p = 0; p + 4 <= raw.length; ) {
    const head = raw.readUInt32LE(p);
    const tag = head & 0x3ff;
    let size = head >>> 20;
    p += 4;
    if (size === 0xfff) {
      size = raw.readUInt32LE(p);
      p += 4;
    }
    if (tag === PARA_TEXT) {
      const text = paragraphText(raw.subarray(p, p + size)).trim();
      if (text) out.push(text);
    }
    p += size;
  }
  return out;
}

export function readHwp(buf: Buffer): string[] {
  const streams = readCfb(buf);
  const header = streams.get('FileHeader');
  if (!header || !header.subarray(0, 17).toString('latin1').startsWith('HWP Document File')) throw new Error('not an HWP 5 file');
  const flags = header.readUInt32LE(36);
  if (flags & 0x2) throw new Error('the document is password-protected');
  const compressed = (flags & 0x1) === 1;
  const names = [...streams.keys()].filter((k) => /^BodyText\/Section\d+$/.test(k)).sort((a, b) => Number(/\d+$/.exec(a)![0]) - Number(/\d+$/.exec(b)![0]));
  const out: string[] = [];
  for (const name of names) {
    const raw = compressed ? zlib.inflateRawSync(streams.get(name)!) : streams.get(name)!;
    out.push(...sectionParagraphs(raw));
  }
  return out;
}
