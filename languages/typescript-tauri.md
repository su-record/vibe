# 🦀 TypeScript + Tauri v2 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄, JSX ≤ 50줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Tauri 아키텍처 이해

```
┌─────────────────────────────────────────────┐
│  Frontend (TypeScript/React/Vue/Svelte)     │
│  - UI 렌더링                                 │
│  - 사용자 인터랙션                           │
│  - @tauri-apps/api 호출                     │
├─────────────────────────────────────────────┤
│  Tauri Core (Rust)                          │
│  - 시스템 API 접근                          │
│  - 파일 시스템, 네트워크                     │
│  - 보안 샌드박스                            │
└─────────────────────────────────────────────┘
```

## TypeScript/Tauri 특화 규칙

### 1. Tauri Command 타입 안전성

```typescript
// ❌ any 사용
const result = await invoke('get_data');

// ✅ 명확한 타입 정의
interface FileInfo {
  path: string;
  size: number;
  modified: number;
}

const fileInfo = await invoke<FileInfo>('get_file_info', { path: '/path/to/file' });

// ✅ Command 응답 타입 정의
interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    throw new Error(`Command ${cmd} failed: ${error}`);
  }
}
```

### 2. Tauri API 사용 패턴

```typescript
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

// ✅ 파일 다이얼로그 + 읽기
async function openFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }]
  });

  if (!selected) return null;

  return await readTextFile(selected as string);
}

// ✅ 파일 저장
async function saveFile(content: string): Promise<void> {
  const path = await save({
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });

  if (path) {
    await writeTextFile(path, content);
  }
}
```

### 3. Event 시스템 활용

```typescript
import { listen, emit } from '@tauri-apps/api/event';

// ✅ 이벤트 리스너 (cleanup 필수)
function useBackendEvent<T>(eventName: string, handler: (payload: T) => void) {
  useEffect(() => {
    const unlisten = listen<T>(eventName, (event) => {
      handler(event.payload);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [eventName, handler]);
}

// ✅ 프론트엔드 → 백엔드 이벤트
async function notifyBackend(action: string, data: unknown): Promise<void> {
  await emit('frontend-action', { action, data });
}
```

### 4. Window 관리

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

// ✅ 창 제어
async function setupWindow(): Promise<void> {
  const appWindow = getCurrentWindow();

  // 창 크기 설정
  await appWindow.setSize(new LogicalSize(800, 600));

  // 창 위치 중앙
  await appWindow.center();

  // 창 제목 설정
  await appWindow.setTitle('My Tauri App');
}

// ✅ 창 이벤트 리스너
function useWindowEvents() {
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const unlistenClose = appWindow.onCloseRequested(async (event) => {
      // 저장되지 않은 변경사항 확인
      if (hasUnsavedChanges) {
        event.preventDefault();
        // 확인 다이얼로그 표시
      }
    });

    return () => {
      unlistenClose.then(fn => fn());
    };
  }, []);
}
```

### 5. Rust Command 정의 (백엔드)

```rust
// src-tauri/src/main.rs 또는 lib.rs

// ✅ Command 정의
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// ✅ 비동기 Command
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())
}

// ✅ State 사용
#[tauri::command]
fn get_count(state: tauri::State<'_, AppState>) -> u32 {
    *state.count.lock().unwrap()
}

// main.rs에서 등록
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, read_file, get_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 6. 보안 설정 (tauri.conf.json)

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'"
    }
  },
  "plugins": {
    "fs": {
      "scope": ["$APP/*", "$RESOURCE/*"]
    },
    "shell": {
      "open": true,
      "scope": []
    }
  }
}
```

### 7. Custom Hook 패턴

```typescript
// ✅ Tauri Command Hook
function useTauriCommand<T, A extends Record<string, unknown>>(
  command: string
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (args?: A) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<T>(command, args);
      setData(result);
      return result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [command]);

  return { data, loading, error, execute };
}

// 사용 예시
function FileViewer() {
  const { data: content, loading, error, execute } = useTauriCommand<string>('read_file');

  const handleOpen = async () => {
    await execute({ path: '/path/to/file.txt' });
  };

  return (
    <div>
      <button onClick={handleOpen} disabled={loading}>
        {loading ? 'Loading...' : 'Open File'}
      </button>
      {error && <p className="error">{error}</p>}
      {content && <pre>{content}</pre>}
    </div>
  );
}
```

### 8. 빌드 및 배포

```bash
# 개발 모드
npm run tauri dev

# 프로덕션 빌드
npm run tauri build

# 특정 타겟
npm run tauri build -- --target x86_64-pc-windows-msvc
npm run tauri build -- --target aarch64-apple-darwin
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

## 폴더 구조 권장

```
my-tauri-app/
├── src/                    # Frontend
│   ├── components/
│   ├── hooks/
│   │   └── useTauri.ts    # Tauri hooks
│   ├── lib/
│   │   └── commands.ts    # Command wrappers
│   └── App.tsx
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   └── commands/      # Command modules
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## 성능 최적화

```typescript
// ✅ 대용량 데이터 스트리밍
import { Channel } from '@tauri-apps/api/core';

async function streamLargeFile(path: string): Promise<void> {
  const channel = new Channel<string>();

  channel.onmessage = (chunk) => {
    // 청크 단위로 처리
    appendToDisplay(chunk);
  };

  await invoke('stream_file', { path, channel });
}

// ✅ 백그라운드 작업
async function runHeavyTask(): Promise<void> {
  // Rust에서 별도 스레드로 처리
  await invoke('heavy_computation', { data: largeData });
}
```

## 디버깅

```typescript
// ✅ 개발 모드에서만 로깅
const isDev = import.meta.env.DEV;

function debugLog(message: string, data?: unknown): void {
  if (isDev) {
    console.log(`[Tauri] ${message}`, data);
  }
}

// ✅ Rust 로그 확인 (터미널에서)
// RUST_LOG=debug npm run tauri dev
```

## 테스트

```typescript
// ✅ Command Mock
import { mockIPC } from '@tauri-apps/api/mocks';

beforeAll(() => {
  mockIPC((cmd, args) => {
    if (cmd === 'greet') {
      return `Hello, ${args.name}!`;
    }
  });
});

test('greet command', async () => {
  const result = await invoke('greet', { name: 'World' });
  expect(result).toBe('Hello, World!');
});
```

## 체크리스트

- [ ] 모든 Command에 타입 정의
- [ ] 이벤트 리스너 cleanup 처리
- [ ] 파일 접근 scope 최소화 (tauri.conf.json)
- [ ] CSP 설정 확인
- [ ] 에러 핸들링 (Rust → Frontend)
- [ ] 대용량 데이터 스트리밍 처리
- [ ] 개발/프로덕션 환경 분리
