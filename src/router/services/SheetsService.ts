/**
 * SheetsService - Google Sheets API v4 operations
 * Create, read, write, append spreadsheet data via REST API
 */

import { InterfaceLogger } from '../../interface/types.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';
import {
  SpreadsheetMetadata,
  SheetInfo,
  CellValue,
  SheetsValuesResponse,
} from './google-types.js';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsService {
  private auth: GoogleAuthManager;
  private logger: InterfaceLogger;

  constructor(auth: GoogleAuthManager, logger: InterfaceLogger) {
    this.auth = auth;
    this.logger = logger;
  }

  /** Create a new spreadsheet */
  async create(title: string): Promise<SpreadsheetMetadata> {
    const res = await this.auth.fetchApi(SHEETS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title },
      }),
    });
    if (!res.ok) {
      throw new Error(`스프레드시트 생성 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      spreadsheetId: string;
      properties: { title: string };
      spreadsheetUrl: string;
      sheets: Array<{ properties: { sheetId: number; title: string } }>;
    };
    return this.toSpreadsheetMetadata(data);
  }

  /** Read cells from a range (A1 notation) */
  async read(spreadsheetId: string, range: string): Promise<CellValue[][]> {
    const encodedRange = encodeURIComponent(range);
    const res = await this.auth.fetchApi(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}`,
    );
    if (!res.ok) {
      throw new Error(`시트 읽기 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as SheetsValuesResponse;
    return (data.values ?? []) as CellValue[][];
  }

  /** Write values to a range */
  async write(spreadsheetId: string, range: string, values: CellValue[][]): Promise<void> {
    const encodedRange = encodeURIComponent(range);
    const res = await this.auth.fetchApi(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, values }),
      },
    );
    if (!res.ok) {
      throw new Error(`시트 쓰기 실패: ${await res.text()}`);
    }
    this.logger('info', `시트 쓰기 완료: ${range}`);
  }

  /** Append values after existing data */
  async append(spreadsheetId: string, range: string, values: CellValue[][]): Promise<void> {
    const encodedRange = encodeURIComponent(range);
    const res = await this.auth.fetchApi(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, values }),
      },
    );
    if (!res.ok) {
      throw new Error(`데이터 추가 실패: ${await res.text()}`);
    }
    this.logger('info', `데이터 추가 완료: ${range}`);
  }

  /** Batch update multiple ranges */
  async batchUpdate(
    spreadsheetId: string,
    data: Array<{ range: string; values: CellValue[][] }>,
  ): Promise<void> {
    const res = await this.auth.fetchApi(
      `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: data.map((d) => ({ range: d.range, values: d.values })),
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`배치 업데이트 실패: ${await res.text()}`);
    }
    this.logger('info', `배치 업데이트 완료: ${data.length}개 범위`);
  }

  private toSpreadsheetMetadata(data: {
    spreadsheetId: string;
    properties: { title: string };
    spreadsheetUrl: string;
    sheets: Array<{ properties: { sheetId: number; title: string } }>;
  }): SpreadsheetMetadata {
    return {
      id: data.spreadsheetId,
      title: data.properties.title,
      url: data.spreadsheetUrl,
      sheets: data.sheets.map((s): SheetInfo => ({
        id: s.properties.sheetId,
        title: s.properties.title,
      })),
    };
  }
}
