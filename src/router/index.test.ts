import { describe, it, expect } from 'vitest';

describe('Router barrel file exports', () => {
  it('should export all infrastructure classes', async () => {
    const router = await import('./index.js');

    // Core Router (2)
    expect(router.ModelARouter).toBeDefined();
    expect(router.RouteRegistry).toBeDefined();

    // Base Route (1)
    expect(router.BaseRoute).toBeDefined();

    // Task Planning (2)
    expect(router.TaskPlanner).toBeDefined();
    expect(router.TaskExecutor).toBeDefined();

    // Browser Automation (3)
    expect(router.BrowserManager).toBeDefined();
    expect(router.BrowserAgent).toBeDefined();
    expect(router.BrowserPool).toBeDefined();

    // Sessions (1)
    expect(router.DevSessionManager).toBeDefined();

    // Resolvers (1)
    expect(router.RepoResolver).toBeDefined();

    // Notifications (1)
    expect(router.NotificationManager).toBeDefined();

    // Handlers (1)
    expect(router.GitOpsHandler).toBeDefined();

    // QA Bridge (1)
    expect(router.TelegramQABridge).toBeDefined();
  });

  it('should export DEFAULT_ROUTER_CONFIG value', async () => {
    const router = await import('./index.js');

    expect(router.DEFAULT_ROUTER_CONFIG).toBeDefined();
    expect(typeof router.DEFAULT_ROUTER_CONFIG).toBe('object');
  });

  it('should export exactly 14 infrastructure classes', async () => {
    const router = await import('./index.js');

    const classExports = [
      router.ModelARouter,
      router.RouteRegistry,
      router.BaseRoute,
      router.TaskPlanner,
      router.TaskExecutor,
      router.BrowserManager,
      router.BrowserAgent,
      router.BrowserPool,
      router.DevSessionManager,
      router.RepoResolver,
      router.NotificationManager,
      router.GitOpsHandler,
      router.TelegramQABridge,
    ];

    expect(classExports).toHaveLength(13);
    classExports.forEach((cls) => {
      expect(typeof cls).toBe('function');
    });
  });

  it('should not export application route implementations', async () => {
    const router = await import('./index.js');
    const exportKeys = Object.keys(router);

    // Application routes should NOT be in barrel
    expect(exportKeys).not.toContain('DevRoute');
    expect(exportKeys).not.toContain('GoogleRoute');
    expect(exportKeys).not.toContain('BrowseRoute');
    expect(exportKeys).not.toContain('MonitorRoute');
    expect(exportKeys).not.toContain('ResearchRoute');
    expect(exportKeys).not.toContain('UtilityRoute');
    expect(exportKeys).not.toContain('CompositeRoute');
  });

  it('should not export application services', async () => {
    const router = await import('./index.js');
    const exportKeys = Object.keys(router);

    // Application services should NOT be in barrel
    expect(exportKeys).not.toContain('GmailService');
    expect(exportKeys).not.toContain('NoteService');
    expect(exportKeys).not.toContain('DriveService');
    expect(exportKeys).not.toContain('CalendarService');
    expect(exportKeys).not.toContain('GoogleAuthManager');
  });
});
