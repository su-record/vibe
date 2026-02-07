/**
 * DriveService Tests
 * Search, create folder, share with mocked API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveService } from './DriveService.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';

const mockLogger = vi.fn();

function createMockAuth(): GoogleAuthManager {
  return {
    fetchApi: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    isAuthenticated: vi.fn().mockReturnValue(true),
  } as unknown as GoogleAuthManager;
}

describe('DriveService', () => {
  let service: DriveService;
  let mockAuth: GoogleAuthManager;

  beforeEach(() => {
    mockLogger.mockClear();
    mockAuth = createMockAuth();
    service = new DriveService(mockAuth, mockLogger);
  });

  describe('search', () => {
    it('should return file metadata list', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          files: [
            { id: 'file-1', name: 'test.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/1' },
            { id: 'file-2', name: 'image.png', mimeType: 'image/png' },
          ],
        }), { status: 200 }),
      );

      const files = await service.search("name contains 'test'");
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('test.pdf');
    });

    it('should return empty array when no files match', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ files: [] }), { status: 200 }),
      );

      const files = await service.search('nonexistent');
      expect(files).toHaveLength(0);
    });
  });

  describe('createFolder', () => {
    it('should create a folder and return metadata', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          id: 'folder-1',
          name: 'New Folder',
          webViewLink: 'https://drive.google.com/folder/1',
        }), { status: 200 }),
      );

      const folder = await service.createFolder('New Folder');
      expect(folder.id).toBe('folder-1');
      expect(folder.name).toBe('New Folder');
    });

    it('should create folder with parent', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          id: 'folder-2',
          name: 'Sub Folder',
        }), { status: 200 }),
      );

      await service.createFolder('Sub Folder', 'parent-id');

      expect(mockAuth.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          body: expect.stringContaining('parent-id'),
        }),
      );
    });
  });

  describe('share', () => {
    it('should share file with another user', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ id: 'perm-1' }), { status: 200 }),
      );

      await expect(
        service.share('file-1', 'user@example.com', 'reader'),
      ).resolves.toBeUndefined();

      expect(mockAuth.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('/permissions'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('user@example.com'),
        }),
      );
    });
  });

  describe('list', () => {
    it('should list files (no folder specified)', async () => {
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          files: [{ id: 'f-1', name: 'file.txt', mimeType: 'text/plain' }],
        }), { status: 200 }),
      );

      const files = await service.list();
      expect(files).toHaveLength(1);
    });
  });
});
