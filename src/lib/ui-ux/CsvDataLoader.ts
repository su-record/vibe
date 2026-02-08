import Papa from 'papaparse';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CSV 데이터 로더 - UI/UX Design Intelligence 시스템용
 *
 * 전역 경로에서 CSV 파일을 로드하며, papaparse를 사용합니다.
 */
export class CsvDataLoader {
  private basePaths: string[];

  constructor(customBasePath?: string) {
    if (customBasePath) {
      this.basePaths = [customBasePath];
    } else {
      const globalPath = join(homedir(), '.claude', 'vibe', 'ui-ux-data');
      const packageFallback = join(__dirname, '../../..', 'vibe', 'ui-ux-data');
      this.basePaths = [globalPath, packageFallback];
    }
  }

  /**
   * CSV 파일을 로드하여 파싱된 데이터를 반환합니다.
   *
   * @param filename - CSV 파일명 (경로 없이 파일명만)
   * @returns 파싱된 데이터 배열 또는 null (에러 시)
   */
  load<T extends Record<string, string>>(filename: string): T[] | null {
    if (!this.isValidFilename(filename)) {
      console.warn(`[CsvDataLoader] Invalid filename: ${filename}`);
      return null;
    }

    const resolvedPath = this.resolveFilePath(filename);
    if (!resolvedPath) {
      console.warn(`[CsvDataLoader] File not found: ${filename}`);
      return null;
    }

    try {
      const rawContent = readFileSync(resolvedPath, 'utf-8');
      const cleanContent = this.removeBom(rawContent);

      const parseResult = Papa.parse<T>(cleanContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string): string => h.trim(),
      });

      if (parseResult.errors.length > 0) {
        console.warn(`[CsvDataLoader] Parse errors in ${filename}:`, parseResult.errors);
        return null;
      }

      return parseResult.data;
    } catch (error) {
      console.warn(`[CsvDataLoader] Error loading ${filename}:`, error);
      return null;
    }
  }

  /**
   * CSV 파일이 존재하는지 확인합니다.
   *
   * @param filename - CSV 파일명
   * @returns 파일 존재 여부
   */
  exists(filename: string): boolean {
    if (!this.isValidFilename(filename)) {
      return false;
    }
    return this.resolveFilePath(filename) !== null;
  }

  /**
   * 첫 번째로 발견된 파일의 전체 경로를 반환합니다.
   * resolve/relative 기반으로 경로가 basePath 내부인지 검증합니다.
   *
   * @param filename - CSV 파일명
   * @returns 파일 경로 또는 null
   */
  private resolveFilePath(filename: string): string | null {
    for (const basePath of this.basePaths) {
      const resolvedBase = resolve(basePath);
      const fullPath = resolve(basePath, filename);
      const rel = relative(resolvedBase, fullPath);

      // basePath 밖으로 벗어나면 거부
      if (rel.startsWith('..') || isAbsolute(rel)) {
        continue;
      }

      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  /**
   * 문자열에서 BOM(Byte Order Mark)을 제거합니다.
   *
   * @param content - 원본 문자열
   * @returns BOM이 제거된 문자열
   */
  private removeBom(content: string): string {
    if (content.charCodeAt(0) === 0xfeff) {
      return content.slice(1);
    }
    return content;
  }

  /**
   * 파일명이 유효한지 검증합니다 (경로 탐색 공격 방지).
   * 절대 경로 및 null 바이트를 차단하고, resolve 기반 containment 검사는
   * resolveFilePath에서 수행합니다.
   *
   * @param filename - 검증할 파일명
   * @returns 유효 여부
   */
  private isValidFilename(filename: string): boolean {
    if (!filename || filename.includes('\0')) {
      return false;
    }
    if (isAbsolute(filename)) {
      return false;
    }
    return true;
  }
}
