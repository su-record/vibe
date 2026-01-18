# ⚡ TypeScript + Electron 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Electron 아키텍처 이해

```
┌─────────────────────────────────────────────┐
│  Main Process (Node.js)                     │
│  - 앱 생명주기 관리                          │
│  - 시스템 API (파일, 네트워크)               │
│  - BrowserWindow 생성/관리                  │
├─────────────────────────────────────────────┤
│  Preload Script (격리된 컨텍스트)            │
│  - contextBridge로 API 노출                 │
│  - Main ↔ Renderer 브릿지                   │
├─────────────────────────────────────────────┤
│  Renderer Process (Chromium)                │
│  - UI 렌더링 (React/Vue/etc)                │
│  - window.electronAPI 사용                  │
└─────────────────────────────────────────────┘
```

## TypeScript/Electron 특화 규칙

### 1. 프로세스 분리 필수

```typescript
// ❌ Renderer에서 직접 Node.js 사용 (보안 취약)
// nodeIntegration: true 금지!

// ✅ Main Process (main.ts)
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,    // 필수!
      nodeIntegration: false,    // 필수!
      sandbox: true              // 권장
    }
  });

  win.loadFile('index.html');
  return win;
}

app.whenReady().then(createWindow);
```

### 2. Preload Script 패턴

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// ✅ 타입 정의
interface ElectronAPI {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  onFileChanged: (callback: (path: string) => void) => () => void;
  platform: NodeJS.Platform;
}

// ✅ 안전하게 API 노출
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

// ✅ 타입 선언 (renderer에서 사용)
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### 3. IPC 통신 타입 안전성

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

// ✅ 타입 안전한 핸들러
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

### 4. Renderer에서 IPC 사용

```typescript
// renderer/hooks/useElectron.ts

// ✅ Custom Hook
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

// ✅ 이벤트 구독 Hook
function useFileWatcher(onChanged: (path: string) => void) {
  useEffect(() => {
    const unsubscribe = window.electronAPI.onFileChanged(onChanged);
    return unsubscribe;
  }, [onChanged]);
}
```

### 5. 창 관리

```typescript
// main.ts
import { BrowserWindow, screen } from 'electron';

// ✅ 창 상태 저장/복원
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

  // 상태 변경 시 저장
  win.on('close', () => {
    saveWindowState({
      ...win.getBounds(),
      isMaximized: win.isMaximized()
    });
  });

  return win;
}

// ✅ 다중 창 관리
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

### 6. 메뉴 구성

```typescript
import { Menu, MenuItemConstructorOptions } from 'electron';

// ✅ 플랫폼별 메뉴
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

### 7. 자동 업데이트

```typescript
import { autoUpdater } from 'electron-updater';

// ✅ 자동 업데이트 설정
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    // 사용자에게 알림
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

  // 앱 시작 시 업데이트 확인
  autoUpdater.checkForUpdates();
}
```

### 8. 보안 체크리스트

```typescript
// ✅ 보안 설정 검증
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

// ✅ 외부 링크 처리
win.webContents.setWindowOpenHandler(({ url }) => {
  // 외부 URL은 시스템 브라우저에서 열기
  if (url.startsWith('https://')) {
    shell.openExternal(url);
  }
  return { action: 'deny' };
});
```

## 폴더 구조 권장

```
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
│   └── shared/             # 공유 타입
│       └── ipc-types.ts
├── electron-builder.yml
└── package.json
```

## 빌드 설정 (electron-builder)

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

## 체크리스트

- [ ] `contextIsolation: true` 설정
- [ ] `nodeIntegration: false` 설정
- [ ] Preload script로만 API 노출
- [ ] IPC 채널 타입 정의
- [ ] 외부 링크 처리 (setWindowOpenHandler)
- [ ] 창 상태 저장/복원
- [ ] 자동 업데이트 설정
- [ ] 플랫폼별 메뉴 구성
- [ ] CSP 헤더 설정
