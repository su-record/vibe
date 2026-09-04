/**
 * OLE2 Compound File Binary — the container of .hwp (and old .doc/.xls). Just enough to read
 * named streams: header, FAT chain, directory entries, mini stream for small streams.
 */
const HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ENDOFCHAIN = 0xfffffffe;

interface Entry {
  name: string;
  type: number;
  start: number;
  size: number;
}

function chain(fat: Uint32Array, start: number, max: number): number[] {
  const out: number[] = [];
  let s = start;
  while (s < ENDOFCHAIN && s < fat.length && out.length <= max) {
    out.push(s);
    s = fat[s]!;
  }
  return out;
}

export function readCfb(buf: Buffer): Map<string, Buffer> {
  if (!buf.subarray(0, 8).equals(HEADER)) throw new Error('not an OLE compound file');
  const sectorSize = 1 << buf.readUInt16LE(30);
  const miniSize = 1 << buf.readUInt16LE(32);
  const dirStart = buf.readUInt32LE(48);
  const miniCutoff = buf.readUInt32LE(56);
  const miniFatStart = buf.readUInt32LE(60);
  const miniFatCount = buf.readUInt32LE(64);
  const difatStart = buf.readUInt32LE(68);
  const sector = (n: number): Buffer => buf.subarray((n + 1) * sectorSize, (n + 2) * sectorSize);
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i += 1) {
    const s = buf.readUInt32LE(76 + i * 4);
    if (s < ENDOFCHAIN) fatSectors.push(s);
  }
  let difat = difatStart;
  while (difat < ENDOFCHAIN) {
    const d = sector(difat);
    for (let i = 0; i < sectorSize / 4 - 1; i += 1) {
      const s = d.readUInt32LE(i * 4);
      if (s < ENDOFCHAIN) fatSectors.push(s);
    }
    difat = d.readUInt32LE(sectorSize - 4);
  }
  const fatBuf = Buffer.concat(fatSectors.map(sector));
  const fatView = new Uint32Array(fatBuf.length / 4);
  for (let i = 0; i < fatView.length; i += 1) fatView[i] = fatBuf.readUInt32LE(i * 4);
  const readChain = (start: number, size: number): Buffer => Buffer.concat(chain(fatView, start, buf.length / sectorSize).map(sector)).subarray(0, size);
  const dirBuf = readChain(dirStart, Number.MAX_SAFE_INTEGER);
  const entries: Entry[] = [];
  for (let off = 0; off + 128 <= dirBuf.length; off += 128) {
    const nameLen = dirBuf.readUInt16LE(off + 64);
    if (nameLen === 0) continue;
    entries.push({ name: dirBuf.subarray(off, off + nameLen - 2).toString('utf16le'), type: dirBuf[off + 66]!, start: dirBuf.readUInt32LE(off + 116), size: dirBuf.readUInt32LE(off + 120) });
  }
  const rootEntry = entries.find((e) => e.type === 5);
  const miniStream = rootEntry ? readChain(rootEntry.start, rootEntry.size) : Buffer.alloc(0);
  const miniFatBuf = miniFatCount > 0 ? readChain(miniFatStart, miniFatCount * sectorSize) : Buffer.alloc(0);
  const miniFat = new Uint32Array(miniFatBuf.length / 4);
  for (let i = 0; i < miniFat.length; i += 1) miniFat[i] = miniFatBuf.readUInt32LE(i * 4);
  const out = new Map<string, Buffer>();
  for (const e of entries) {
    if (e.type !== 2) continue;
    if (e.size < miniCutoff) out.set(e.name, Buffer.concat(chain(miniFat, e.start, miniStream.length / miniSize).map((s) => miniStream.subarray(s * miniSize, (s + 1) * miniSize))).subarray(0, e.size));
    else out.set(e.name, readChain(e.start, e.size));
  }
  return out;
}
