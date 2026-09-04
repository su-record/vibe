import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { zipStore } from '../../install/mcpb.js';
import { readCfb } from './cfb.js';
import { htmlText } from './html.js';
import { readDocument } from './read.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-hwp-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

/** A minimal OLE compound file: 512-byte sectors, one FAT sector, one directory sector, every stream in regular sectors (mini cutoff 0). */
function cfb(streams: Array<{ name: string; data: Buffer }>): Buffer {
  const S = 512;
  const sectors: Buffer[] = [];
  const fat: number[] = [];
  const entries: Buffer[] = [];
  const dirEntry = (name: string, type: number, start: number, size: number, child = 0xffffffff): Buffer => {
    const e = Buffer.alloc(128, 0);
    const n = Buffer.from(name, 'utf16le');
    n.copy(e, 0);
    e.writeUInt16LE(n.length + 2, 64);
    e[66] = type;
    e[67] = 1;
    e.writeUInt32LE(0xffffffff, 68);
    e.writeUInt32LE(0xffffffff, 72);
    e.writeUInt32LE(child, 76);
    e.writeUInt32LE(start, 116);
    e.writeUInt32LE(size, 120);
    return e;
  };
  // sector 0 = FAT, sector 1 = directory, streams follow
  sectors.push(Buffer.alloc(S), Buffer.alloc(S));
  fat.push(0xfffffffd, 0xfffffffe);
  const streamEntries: Buffer[] = [];
  for (const s of streams) {
    const start = sectors.length;
    const count = Math.max(1, Math.ceil(s.data.length / S));
    for (let i = 0; i < count; i += 1) {
      const chunk = Buffer.alloc(S);
      s.data.copy(chunk, 0, i * S, Math.min((i + 1) * S, s.data.length));
      sectors.push(chunk);
      fat.push(i === count - 1 ? 0xfffffffe : start + i + 1);
    }
    streamEntries.push(dirEntry(s.name, 2, start, s.data.length));
  }
  entries.push(dirEntry('Root Entry', 5, 0xfffffffe, 0, 1), ...streamEntries);
  const dir = sectors[1]!;
  Buffer.concat(entries).copy(dir, 0);
  const fatSector = sectors[0]!;
  fat.forEach((v, i) => fatSector.writeUInt32LE(v, i * 4));
  for (let i = fat.length; i < S / 4; i += 1) fatSector.writeUInt32LE(0xffffffff, i * 4);
  const header = Buffer.alloc(S, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x003e, 24);
  header.writeUInt16LE(0x0003, 26);
  header.writeUInt16LE(0xfffe, 28);
  header.writeUInt16LE(9, 30);
  header.writeUInt16LE(6, 32);
  header.writeUInt32LE(1, 44); // FAT sector count
  header.writeUInt32LE(1, 48); // directory start
  header.writeUInt32LE(0, 56); // mini cutoff 0 → no mini streams
  header.writeUInt32LE(0xfffffffe, 60);
  header.writeUInt32LE(0, 64);
  header.writeUInt32LE(0xfffffffe, 68);
  header.writeUInt32LE(0, 72);
  header.writeUInt32LE(0, 76); // DIFAT[0] = FAT at sector 0
  for (let i = 1; i < 109; i += 1) header.writeUInt32LE(0xffffffff, 76 + i * 4);
  return Buffer.concat([header, ...sectors]);
}

function record(tag: number, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32LE((tag & 0x3ff) | (0 << 10) | (data.length << 20), 0);
  return Buffer.concat([head, data]);
}

function paraText(text: string, withInlineControl = false): Buffer {
  const parts = [Buffer.from(text, 'utf16le')];
  if (withInlineControl) parts.unshift(Buffer.concat([Buffer.from([4, 0]), Buffer.alloc(14)])); // an 8-code-unit inline control
  parts.push(Buffer.from([13, 0]));
  return Buffer.concat(parts);
}

describe('Hangul files and HTML', () => {
  it('hwp: paragraphs come out of a compressed HWP 5 body, controls skipped, sections in order', () => {
    const fileHeader = Buffer.alloc(256, 0);
    Buffer.from('HWP Document File', 'latin1').copy(fileHeader, 0);
    fileHeader.writeUInt32LE(1, 36); // compressed
    const section0 = Buffer.concat([record(66, Buffer.alloc(22)), record(67, paraText('정산표 안내', true)), record(67, paraText('첫째 줄\n둘째 줄'.replace('\n', '\n')))]);
    const section1 = record(67, paraText('부록'));
    const hwp = cfb([
      { name: 'FileHeader', data: fileHeader },
      { name: 'BodyText/Section1', data: zlib.deflateRawSync(section1) },
      { name: 'BodyText/Section0', data: zlib.deflateRawSync(section0) },
    ]);
    expect([...readCfb(hwp).keys()].sort()).toEqual(['BodyText/Section0', 'BodyText/Section1', 'FileHeader']);
    fs.writeFileSync(path.join(root, 'notice.hwp'), hwp);
    const d = readDocument(root, 'notice.hwp');
    expect(d).toMatchObject({ format: 'hwp', method: 'hwp5' });
    expect(d.sections.map((s) => s.text)).toEqual(['정산표 안내', '첫째 줄\n둘째 줄', '부록']);
    const locked = Buffer.from(fileHeader);
    locked.writeUInt32LE(3, 36);
    fs.writeFileSync(path.join(root, 'locked.hwp'), cfb([{ name: 'FileHeader', data: locked }]));
    expect(() => readDocument(root, 'locked.hwp')).toThrowError(/password/);
  });

  it('hwpx: paragraphs from OWPML sections in order', () => {
    fs.writeFileSync(path.join(root, 'notice.hwpx'), zipStore([
      { name: 'Contents/section1.xml', data: Buffer.from('<hs:sec><hp:p><hp:run><hp:t>둘째 절</hp:t></hp:run></hp:p></hs:sec>') },
      { name: 'Contents/section0.xml', data: Buffer.from('<hs:sec><hp:p><hp:run><hp:t>제목 </hp:t></hp:run><hp:run><hp:t>&amp; 부제</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>본문</hp:t></hp:run></hp:p></hs:sec>') },
    ]));
    const d = readDocument(root, 'notice.hwpx');
    expect(d).toMatchObject({ format: 'hwpx', method: 'owpml' });
    expect(d.sections.map((s) => s.text)).toEqual(['제목 & 부제', '본문', '둘째 절']);
  });

  it('html: content without markup — scripts and styles gone, blocks on their own lines, table cells joined', () => {
    const text = htmlText('<html><head><style>p{}</style><script>x()</script></head><body><h1>Report</h1><p>Total &amp; tax</p><ul><li>one</li><li>two</li></ul><table><tr><th>seller</th><th>total</th></tr><tr><td>Han</td><td>2,200</td></tr></table></body></html>');
    expect(text).toBe('Report\nTotal & tax\n- one\n- two\nseller | total\nHan | 2,200');
    fs.writeFileSync(path.join(root, 'r.html'), '<p>hi</p>');
    expect(readDocument(root, 'r.html')).toMatchObject({ format: 'html', method: 'html' });
  });
});
