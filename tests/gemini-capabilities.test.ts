/**
 * Gemini Voice / Vision / Chat 기능 테스트
 * 실행: npx tsx tests/gemini-capabilities.test.ts
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

// .env 수동 로드
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

import { chat, ask, quickAsk } from '../dist/infra/lib/gemini/chat.js';
import { analyzeImage, transcribeAudio, webSearch } from '../dist/infra/lib/gemini/capabilities.js';
import { getAuthInfo } from '../dist/infra/lib/gemini/auth.js';

const TEMP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

// ── Helpers ──

function createTestImage(): string {
  // 100x100 red PNG (zlib compressed, no external dependency)
  const width = 100;
  const height = 100;

  // Raw pixel data: filter byte (0) + RGB per row
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 3);
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 3;
      rawData[px] = 0xFF;     // R
      rawData[px + 1] = 0x00; // G
      rawData[px + 2] = 0x00; // B
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG CRC helper
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  function crc32(data: Buffer): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function pngChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, checksum]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const filePath = path.join(TEMP_DIR, 'test-image.png');
  fs.writeFileSync(filePath, png);
  return filePath;
}

function createTestWav(): string {
  // 최소한의 WAV 파일 (0.1초 무음, 16kHz, 16-bit, mono)
  const sampleRate = 16000;
  const duration = 0.1;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2; // 16-bit = 2 bytes
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // samples = all zeros (silence)

  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const filePath = path.join(TEMP_DIR, 'test-audio.wav');
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// ── Tests ──

async function testAuth(): Promise<boolean> {
  console.log('\n=== 1. Auth Check ===');
  try {
    const auth = await getAuthInfo();
    console.log(`  Type: ${auth.type}`);
    console.log(`  Email: ${auth.email || '(none)'}`);
    console.log(`  Token: ${auth.accessToken ? 'present' : 'missing'}`);
    console.log(`  API Key: ${auth.apiKey ? 'present' : 'missing'}`);
    console.log('  PASS');
    return true;
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    return false;
  }
}

async function testChat(): Promise<boolean> {
  console.log('\n=== 2. Chat (basic) ===');
  try {
    const result = await ask('Say "hello" in Korean. Reply with just the word.', {
      model: 'gemini-flash',
      maxTokens: 50,
      temperature: 0,
    });
    console.log(`  Response: ${result}`);
    console.log('  PASS');
    return true;
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    return false;
  }
}

async function testVision(): Promise<boolean> {
  console.log('\n=== 3. Vision (Image Analysis) ===');
  try {
    const imagePath = createTestImage();
    console.log(`  Test image: ${imagePath}`);
    const result = await analyzeImage(imagePath, 'Describe this image. What color is it?');
    console.log(`  Response: ${result.substring(0, 200)}`);
    console.log('  PASS');
    return true;
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    return false;
  }
}

async function testVoice(): Promise<boolean> {
  console.log('\n=== 4. Voice (Audio Transcription) ===');
  try {
    const audioPath = createTestWav();
    console.log(`  Test audio: ${audioPath}`);
    const result = await transcribeAudio(audioPath);
    console.log(`  Transcription: "${result.transcription}"`);
    console.log(`  Duration: ${result.duration}s`);
    console.log('  PASS (silence expected)');
    return true;
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    return false;
  }
}

async function testWebSearch(): Promise<boolean> {
  console.log('\n=== 5. Web Search ===');
  try {
    const result = await webSearch('What is the current date today?');
    console.log(`  Response: ${result.substring(0, 200)}`);
    console.log('  PASS');
    return true;
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    return false;
  }
}

// ── Main ──

async function main(): Promise<void> {
  console.log('Gemini Capabilities Test');
  console.log('========================');

  const results: Array<[string, boolean]> = [];

  results.push(['Auth', await testAuth()]);
  results.push(['Chat', await testChat()]);
  results.push(['Vision', await testVision()]);
  results.push(['Voice', await testVoice()]);
  results.push(['WebSearch', await testWebSearch()]);

  console.log('\n========================');
  console.log('Results:');
  for (const [name, passed] of results) {
    console.log(`  ${passed ? 'PASS' : 'FAIL'} ${name}`);
  }

  const allPassed = results.every(([, p]) => p);
  console.log(`\n${allPassed ? 'All tests passed!' : 'Some tests failed.'}`);

  // cleanup
  try {
    const testImage = path.join(TEMP_DIR, 'test-image.png');
    const testAudio = path.join(TEMP_DIR, 'test-audio.wav');
    if (fs.existsSync(testImage)) fs.unlinkSync(testImage);
    if (fs.existsSync(testAudio)) fs.unlinkSync(testAudio);
  } catch { /* ignore */ }

  process.exit(allPassed ? 0 : 1);
}

main();
