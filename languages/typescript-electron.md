# TypeScript + Electron Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Electron Architecture Understanding

```text
Main Process (Node.js)
- App lifecycle management
- System APIs (file, network)
- BrowserWindow creation/management

Preload Script (Isolated Context)
- Expose APIs via contextBridge
- Main <-> Renderer bridge

Renderer Process (Chromium)
- UI rendering (React/Vue/etc)
- Use window.electronAPI
```

## TypeScript/Electron Specific Rules

### 1. Process Separation Required

```typescript
// Bad: Direct Node.js usage in Renderer (security vulnerability)
// nodeIntegration: true is prohibited!

// Good: Main Process (main.ts)
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,    // Required!
      nodeIntegration: false,    // Required!
      sandbox: true              // Recommended
    }
  });

  win.loadFile('index.html');
  return win;
}

app.whenReady().then(createWindow);
```

### 2. Preload Script Pattern

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Good: Type definition
interface ElectronAPI {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  onFileChanged: (callback: (path: string) => void) => () => void;
  platform: NodeJS.Platform;
}

// Good: Safely expose API
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('write-file', path, content),
  onFileChanged: (callback: (path: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('file-changed', handler);
    return () => ipcRenderer.removeListener('file-changed', handler);
  },
  platform: process.platform
} satisfies ElectronAPI);

// Good: Type declaration (for use in renderer)
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### 3. IPC Communication Type Safety

```typescript
// shared/ipc-types.ts
export interface IpcChannels {
  'read-file': { args: [string]; return: string };
  'write-file': { args: [string, string]; return: void };
  'get-app-info': { args: []; return: AppInfo };
}

export interface AppInfo {
  version: string;
  name: string;
  paths: {
    userData: string;
    temp: string;
  };
}

// main.ts
import { ipcMain } from 'electron';
import fs from 'fs/promises';

// Good: Type-safe handler
ipcMain.handle('read-file', async (_event, path: string): Promise<string> => {
  return fs.readFile(path, 'utf-8');
});

ipcMain.handle('write-file', async (_event, path: string, content: string): Promise<void> => {
  await fs.writeFile(path, content, 'utf-8');
});

ipcMain.handle('get-app-info', async (): Promise<AppInfo> => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    paths: {
      userData: app.getPath('userData'),
      temp: app.getPath('temp')
    }
  };
});
```

### 4. IPC Usage in Renderer

```typescript
// renderer/hooks/useElectron.ts

// Good: Custom Hook
function useFileReader() {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.readFile(path);
      setContent(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { content, loading, error, readFile };
}

// Good: Event subscription Hook
function useFileWatcher(onChanged: (path: string) => void) {
  useEffect(() => {
    const unsubscribe = window.electronAPI.onFileChanged(onChanged);
    return unsubscribe;
  }, [onChanged]);
}
```

### 5. Window Management

```typescript
// main.ts
import { BrowserWindow, screen } from 'electron';

// Good: Save/restore window state
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function createWindowWithState(): BrowserWindow {
  const state = loadWindowState();

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (state.isMaximized) {
    win.maximize();
  }

  // Save state on change
  win.on('close', () => {
    saveWindowState({
      ...win.getBounds(),
      isMaximized: win.isMaximized()
    });
  });

  return win;
}

// Good: Multiple window management
const windows = new Map<string, BrowserWindow>();

function getOrCreateWindow(id: string): BrowserWindow {
  const existing = windows.get(id);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({ /* ... */ });
  windows.set(id, win);
  win.on('closed', () => windows.delete(id));
  return win;
}
```

### 6. Menu Configuration

```typescript
import { Menu, MenuItemConstructorOptions } from 'electron';

// Good: Platform-specific menu
function createMenu(): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpen()
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => handleSave()
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}
```

### 7. Auto Update

```typescript
import { autoUpdater } from 'electron-updater';

// Good: Auto update setup
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    // Notify user
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      buttons: ['Download', 'Later']
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Restart to install update?',
      buttons: ['Restart', 'Later']
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Check for updates on app start
  autoUpdater.checkForUpdates();
}
```

### 8. Security Checklist

```typescript
// Good: Validate security settings
function validateSecuritySettings(win: BrowserWindow): void {
  const webPrefs = win.webContents.getWebPreferences();

  if (webPrefs.nodeIntegration) {
    console.error('SECURITY: nodeIntegration should be false');
  }
  if (!webPrefs.contextIsolation) {
    console.error('SECURITY: contextIsolation should be true');
  }
  if (!webPrefs.sandbox) {
    console.warn('SECURITY: sandbox is recommended');
  }
}

// Good: Handle external links
win.webContents.setWindowOpenHandler(({ url }) => {
  // Open external URLs in system browser
  if (url.startsWith('https://')) {
    shell.openExternal(url);
  }
  return { action: 'deny' };
});
```

## Recommended Folder Structure

```text
my-electron-app/
├── src/
│   ├── main/               # Main Process
│   │   ├── main.ts
│   │   ├── ipc-handlers.ts
│   │   └── menu.ts
│   ├── preload/            # Preload Scripts
│   │   └── preload.ts
│   ├── renderer/           # Renderer (React/Vue)
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── shared/             # Shared types
│       └── ipc-types.ts
├── electron-builder.yml
└── package.json
```

## Build Configuration (electron-builder)

```yaml
# electron-builder.yml
appId: com.example.myapp
productName: MyApp
directories:
  output: dist
files:
  - "build/**/*"
  - "node_modules/**/*"
mac:
  target: [dmg, zip]
  category: public.app-category.developer-tools
win:
  target: [nsis, portable]
linux:
  target: [AppImage, deb]
```

## Checklist

- [ ] `contextIsolation: true` configured
- [ ] `nodeIntegration: false` configured
- [ ] Expose APIs only through preload script
- [ ] Define IPC channel types
- [ ] Handle external links (setWindowOpenHandler)
- [ ] Save/restore window state
- [ ] Auto update setup
- [ ] Platform-specific menu configuration
- [ ] CSP header configured
