/**
 * SheetsService Tests
 * Create, read, write, append, batch update
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetsService } from './SheetsService.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';

const mockLogger = vi.fn();

function createMockAuth(): GoogleAuthManager {
  return {
    fetchApi: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    isAuthenticated: vi.fn().mockReturnValue(true),
  } as unknown as GoogleAuthManager;
}

describe('SheetsService', () => {
  let service: SheetsService;
  let mockAuth: GoogleAuthManager;

  beforeEach(() => {
    mockLogger.mockClear();
    mockAuth = createMockAuth();
    service = new SheetsService(mockAuth, mockLogger);
  });

  describe('create', () => {
    it('should create a spreadsheet and return metadata', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          spreadsheetId: 'sheet-1',
          properties: { title: 'Test Sheet' },
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1',
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        }), { status: 200 }),
      );

      const result = await service.create('Test Sheet');
      expect(result.id).toBe('sheet-1');
      expect(result.title).toBe('Test Sheet');
      expect(result.sheets).toHaveLength(1);
    });
  });

  describe('read', () => {
    it('should return cell values', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          range: 'Sheet1!A1:B2',
          majorDimension: 'ROWS',
          values: [
            ['Name', 'Value'],
            ['Alice', '100'],
          ],
        }), { status: 200 }),
      );

      const values = await service.read('sheet-1', 'Sheet1!A1:B2');
      expect(values).toHaveLength(2);
      expect(values[0][0]).toBe('Name');
      expect(values[1][1]).toBe('100');
    });

    it('should return empty array when no data', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          range: 'Sheet1!A1:B2',
          majorDimension: 'ROWS',
        }), { status: 200 }),
      );

      const values = await service.read('sheet-1', 'Sheet1!A1:B2');
      expect(values).toHaveLength(0);
    });
  });

  describe('write', () => {
    it('should write values to a range', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ updatedRange: 'Sheet1!A1:B1' }), { status: 200 }),
      );

      await expect(
        service.write('sheet-1', 'Sheet1!A1:B1', [['Hello', 'World']]),
      ).resolves.toBeUndefined();

      expect(mockAuth.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('valueInputOption=USER_ENTERED'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('append', () => {
    it('should append values after existing data', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ updates: { updatedRows: 1 } }), { status: 200 }),
      );

      await expect(
        service.append('sheet-1', 'Sheet1!A:B', [['Alice', '200']]),
      ).resolves.toBeUndefined();

      expect(mockAuth.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining(':append'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('batchUpdate', () => {
    it('should update multiple ranges', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ totalUpdatedRows: 2 }), { status: 200 }),
      );

      await expect(
        service.batchUpdate('sheet-1', [
          { range: 'Sheet1!A1', values: [['A']] },
          { range: 'Sheet1!B1', values: [['B']] },
        ]),
      ).resolves.toBeUndefined();

      expect(mockAuth.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('batchUpdate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
