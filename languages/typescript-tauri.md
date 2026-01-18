# TypeScript + Tauri v2 Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines, JSX <= 50 lines
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Tauri Architecture Understanding

```text
Frontend (TypeScript/React/Vue/Svelte)
- UI rendering
- User interaction
- @tauri-apps/api calls

Tauri Core (Rust)
- System API access
- File system, network
- Security sandbox
```

## TypeScript/Tauri Specific Rules

### 1. Tauri Command Type Safety

```typescript
// Bad: Using any
const result = await invoke('get_data');

// Good: Clear type definition
interface FileInfo {
  path: string;
  size: number;
  modified: number;
}

const fileInfo = await invoke<FileInfo>('get_file_info', { path: '/path/to/file' });

// Good: Command response type definition
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

### 2. Tauri API Usage Patterns

```typescript
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

// Good: File dialog + read
async function openFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }]
  });

  if (!selected) return null;

  return await readTextFile(selected as string);
}

// Good: File save
async function saveFile(content: string): Promise<void> {
  const path = await save({
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });

  if (path) {
    await writeTextFile(path, content);
  }
}
```

### 3. Event System Usage

```typescript
import { listen, emit } from '@tauri-apps/api/event';

// Good: Event listener (cleanup required)
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

// Good: Frontend -> Backend event
async function notifyBackend(action: string, data: unknown): Promise<void> {
  await emit('frontend-action', { action, data });
}
```

### 4. Window Management

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

// Good: Window control
async function setupWindow(): Promise<void> {
  const appWindow = getCurrentWindow();

  // Set window size
  await appWindow.setSize(new LogicalSize(800, 600));

  // Center window
  await appWindow.center();

  // Set window title
  await appWindow.setTitle('My Tauri App');
}

// Good: Window event listener
function useWindowEvents() {
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const unlistenClose = appWindow.onCloseRequested(async (event) => {
      // Check for unsaved changes
      if (hasUnsavedChanges) {
        event.preventDefault();
        // Show confirmation dialog
      }
    });

    return () => {
      unlistenClose.then(fn => fn());
    };
  }, []);
}
```

### 5. Rust Command Definition (Backend)

```rust
// src-tauri/src/main.rs or lib.rs

// Good: Command definition
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Good: Async Command
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())
}

// Good: Using State
#[tauri::command]
fn get_count(state: tauri::State<'_, AppState>) -> u32 {
    *state.count.lock().unwrap()
}

// Register in main.rs
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, read_file, get_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 6. Security Configuration (tauri.conf.json)

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

### 7. Custom Hook Pattern

```typescript
// Good: Tauri Command Hook
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

// Usage example
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

### 8. Build and Deploy

```bash
# Development mode
npm run tauri dev

# Production build
npm run tauri build

# Specific target
npm run tauri build -- --target x86_64-pc-windows-msvc
npm run tauri build -- --target aarch64-apple-darwin
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

## Recommended Folder Structure

```text
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

## Performance Optimization

```typescript
// Good: Large data streaming
import { Channel } from '@tauri-apps/api/core';

async function streamLargeFile(path: string): Promise<void> {
  const channel = new Channel<string>();

  channel.onmessage = (chunk) => {
    // Process chunk by chunk
    appendToDisplay(chunk);
  };

  await invoke('stream_file', { path, channel });
}

// Good: Background task
async function runHeavyTask(): Promise<void> {
  // Process in separate thread in Rust
  await invoke('heavy_computation', { data: largeData });
}
```

## Debugging

```typescript
// Good: Logging only in development mode
const isDev = import.meta.env.DEV;

function debugLog(message: string, data?: unknown): void {
  if (isDev) {
    console.log(`[Tauri] ${message}`, data);
  }
}

// Good: Check Rust logs (in terminal)
// RUST_LOG=debug npm run tauri dev
```

## Testing

```typescript
// Good: Command Mock
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

## Checklist

- [ ] Define types for all Commands
- [ ] Handle event listener cleanup
- [ ] Minimize file access scope (tauri.conf.json)
- [ ] Verify CSP configuration
- [ ] Error handling (Rust -> Frontend)
- [ ] Handle large data streaming
- [ ] Separate development/production environments
