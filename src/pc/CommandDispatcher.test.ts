/**
 * CommandDispatcher Tests — Phase 6-7
 *
 * GPT 기반 분류 → Mock classifier DI로 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandDispatcher } from './CommandDispatcher.js';
import type { IntentClassifyFn } from './CommandDispatcher.js';
import { ModuleRegistry } from './ModuleRegistry.js';
import { SessionContextManager } from './SessionContext.js';
import type { IntegrationLogger, ModuleName, ClassifiedIntent, IntentCategory } from './types.js';

// ============================================================================
// Mock Classifier (GPT 대신 사용)
// ============================================================================

/** 테스트용 mock classifier — 입력 키워드로 카테고리 결정 */
function createMockClassifier(): IntentClassifyFn {
  const rules: Array<{ keywords: string[]; category: IntentCategory }> = [
    { keywords: ['검색', 'search', '요약', '번역', '유튜브', 'youtube'], category: 'google' },
    { keywords: ['브라우저', 'browse', '사이트', 'website', '열어', 'open', '클릭', '로그인', 'gmail', '드라이브'], category: 'browser' },
    { keywords: ['음성', 'voice', '읽어', 'tts', 'stt'], category: 'voice' },
    { keywords: ['화면', '캡처', 'screen', 'capture', 'vision'], category: 'vision' },
    { keywords: ['코드', '실행', '샌드박스', 'sandbox', 'exec', 'run'], category: 'sandbox' },
  ];

  return async (input: string): Promise<ClassifiedIntent> => {
    const lower = input.toLowerCase();
    for (const rule of rules) {
      if (rule.keywords.some(kw => lower.includes(kw))) {
        return { category: rule.category, confidence: 0.9 };
      }
    }
    return { category: 'general', confidence: 1.0 };
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createTestSetup(): {
  logger: IntegrationLogger;
  registry: ModuleRegistry;
  context: SessionContextManager;
  dispatcher: CommandDispatcher;
} {
  const logger = vi.fn() as IntegrationLogger;
  const registry = new ModuleRegistry(logger);
  const context = new SessionContextManager(logger);
  const classifier = createMockClassifier();
  const dispatcher = new CommandDispatcher(registry, context, logger, classifier);
  return { logger, registry, context, dispatcher };
}

function registerMockModule(registry: ModuleRegistry, name: ModuleName): void {
  registry.register(name, {
    init: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('CommandDispatcher', () => {
  let setup: ReturnType<typeof createTestSetup>;

  beforeEach(() => {
    setup = createTestSetup();
  });

  afterEach(() => {
    setup.context.shutdown();
  });

  describe('classifyIntent (GPT-based via mock)', () => {
    it('검색 → google (Gemini)', async () => {
      const intent = await setup.dispatcher.classifyIntent('Node.js 22 검색해줘');
      expect(intent.category).toBe('google');
      expect(intent.confidence).toBeGreaterThan(0);
    });

    it('브라우저 열기 → browser', async () => {
      const intent = await setup.dispatcher.classifyIntent('Gmail 확인해줘');
      expect(intent.category).toBe('browser');
    });

    it('유튜브 분석 → google (Gemini)', async () => {
      const intent = await setup.dispatcher.classifyIntent('유튜브에서 영상 분석해줘');
      expect(intent.category).toBe('google');
    });

    it('요약/번역 → google (Gemini)', async () => {
      const intent = await setup.dispatcher.classifyIntent('이 내용 요약해줘');
      expect(intent.category).toBe('google');
    });

    it('음성 → voice', async () => {
      const intent = await setup.dispatcher.classifyIntent('이 텍스트를 음성으로 읽어줘');
      expect(intent.category).toBe('voice');
    });

    it('화면 캡처 → vision', async () => {
      const intent = await setup.dispatcher.classifyIntent('현재 화면 캡처해줘');
      expect(intent.category).toBe('vision');
    });

    it('코드 실행 → sandbox', async () => {
      const intent = await setup.dispatcher.classifyIntent('샌드박스에서 코드 실행해줘');
      expect(intent.category).toBe('sandbox');
    });

    it('일반 대화 → general', async () => {
      const intent = await setup.dispatcher.classifyIntent('안녕하세요');
      expect(intent.category).toBe('general');
      expect(intent.confidence).toBe(1.0);
    });

    it('영어: search → google', async () => {
      const intent = await setup.dispatcher.classifyIntent('search for react docs');
      expect(intent.category).toBe('google');
    });

    it('영어: open website → browser', async () => {
      const intent = await setup.dispatcher.classifyIntent('open the website');
      expect(intent.category).toBe('browser');
    });
  });

  describe('DI: custom classifier injection', () => {
    it('커스텀 classifier가 주입되면 그걸 사용', async () => {
      const customClassifier: IntentClassifyFn = async () => ({
        category: 'sandbox',
        confidence: 1.0,
      });
      const dispatcher = new CommandDispatcher(
        setup.registry, setup.context, setup.logger, customClassifier,
      );
      const intent = await dispatcher.classifyIntent('아무거나');
      expect(intent.category).toBe('sandbox');
    });

    it('classifier 미지정 시 기본 gptClassifyIntent 사용', () => {
      // constructor에 classifier 없이 생성 — 에러 없이 생성되어야 함
      const dispatcher = new CommandDispatcher(
        setup.registry, setup.context, setup.logger,
      );
      expect(dispatcher).toBeDefined();
    });
  });

  describe('isCompound', () => {
    it('복합 명령 감지: 그리고', () => {
      expect(setup.dispatcher.isCompound('Gmail 확인하고 Slack으로 보내줘')).toBe(true);
    });

    it('복합 명령 감지: 다음에', () => {
      expect(setup.dispatcher.isCompound('검색 다음에 결과 캡처해줘')).toBe(true);
    });

    it('복합 명령 감지: and then', () => {
      expect(setup.dispatcher.isCompound('search and then screenshot')).toBe(true);
    });

    it('단일 명령', () => {
      expect(setup.dispatcher.isCompound('Gmail 확인해줘')).toBe(false);
    });
  });

  describe('dispatch', () => {
    it('활성 모듈로 라우팅', async () => {
      registerMockModule(setup.registry, 'browser');
      await setup.registry.initModule('browser');

      const result = await setup.dispatcher.dispatch('브라우저로 사이트 열어줘', 'user-1', 'telegram');
      expect(result.success).toBe(true);
      expect(result.module).toBe('browser');
    });

    it('비활성 모듈은 에러 반환', async () => {
      registerMockModule(setup.registry, 'vision');
      // vision is registered but not initialized (disabled)

      const result = await setup.dispatcher.dispatch('화면 캡처해줘', 'user-1', 'telegram');
      expect(result.success).toBe(false);
      expect(result.error).toContain('비활성화');
    });

    it('general 의도는 모듈 체크 없이 성공', async () => {
      const result = await setup.dispatcher.dispatch('안녕하세요', 'user-1', 'telegram');
      expect(result.success).toBe(true);
      expect(result.module).toBe('general');
    });

    it('세션 컨텍스트에 기록됨', async () => {
      registerMockModule(setup.registry, 'browser');
      await setup.registry.initModule('browser');

      await setup.dispatcher.dispatch('Gmail 확인', 'user-1', 'telegram');
      const history = setup.context.getHistory('user-1', 'telegram');
      expect(history.length).toBe(1);
      expect(history[0].module).toBe('browser');
    });
  });

  describe('dispatchCompound', () => {
    it('복합 명령 분리 실행', async () => {
      registerMockModule(setup.registry, 'browser');
      registerMockModule(setup.registry, 'voice');
      await setup.registry.initModule('browser');
      await setup.registry.initModule('voice');

      const result = await setup.dispatcher.dispatchCompound(
        'Gmail 확인하고 음성으로 읽어줘',
        'user-1', 'telegram',
      );
      expect(result.steps.length).toBe(2);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('단계 실패 시 중단', async () => {
      registerMockModule(setup.registry, 'browser');
      await setup.registry.initModule('browser');
      // vision not initialized

      const result = await setup.dispatcher.dispatchCompound(
        'Gmail 확인하고 화면 캡처해줘',
        'user-1', 'telegram',
      );
      expect(result.steps.some(s => !s.success)).toBe(true);
      expect(result.partialSuccess).toBe(true);
    });
  });
});

// ============================================================================
// ModuleRegistry Tests
// ============================================================================

describe('ModuleRegistry', () => {
  let logger: IntegrationLogger;
  let registry: ModuleRegistry;

  beforeEach(() => {
    logger = vi.fn() as IntegrationLogger;
    registry = new ModuleRegistry(logger);
  });

  afterEach(async () => {
    await registry.shutdownAll();
  });

  it('모듈 등록 및 조회', () => {
    registerMockModule(registry, 'browser');
    const info = registry.get('browser');
    expect(info?.name).toBe('browser');
    expect(info?.state).toBe('disabled');
  });

  it('모듈 초기화', async () => {
    registerMockModule(registry, 'browser');
    const ok = await registry.initModule('browser');
    expect(ok).toBe(true);
    expect(registry.isEnabled('browser')).toBe(true);
  });

  it('초기화 실패 시 error 상태', async () => {
    registry.register('vision', {
      init: vi.fn().mockRejectedValue(new Error('GEMINI_API_KEY 미설정')),
      shutdown: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue(true),
    });
    const ok = await registry.initModule('vision');
    expect(ok).toBe(false);
    expect(registry.get('vision')?.state).toBe('error');
  });

  it('전체 모듈 초기화 순서: sandbox → browser → google → voice → vision', async () => {
    const initOrder: string[] = [];
    const modules: ModuleName[] = ['browser', 'google', 'voice', 'vision', 'sandbox'];
    for (const name of modules) {
      registry.register(name, {
        init: vi.fn().mockImplementation(async () => { initOrder.push(name); }),
        shutdown: vi.fn().mockResolvedValue(undefined),
        healthCheck: vi.fn().mockResolvedValue(true),
      });
    }
    await registry.initAll(modules);
    expect(initOrder).toEqual(['sandbox', 'browser', 'google', 'voice', 'vision']);
  });

  it('셧다운은 역순', async () => {
    const shutdownOrder: string[] = [];
    const modules: ModuleName[] = ['browser', 'google', 'sandbox'];
    for (const name of modules) {
      registry.register(name, {
        init: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockImplementation(async () => { shutdownOrder.push(name); }),
        healthCheck: vi.fn().mockResolvedValue(true),
      });
    }
    await registry.initAll(modules);
    await registry.shutdownAll();
    expect(shutdownOrder).toEqual(['google', 'browser', 'sandbox']);
  });

  it('활성 모듈 목록', async () => {
    registerMockModule(registry, 'browser');
    registerMockModule(registry, 'google');
    await registry.initModule('browser');
    expect(registry.getEnabledModules()).toEqual(['browser']);
  });

  it('헬스체크 3회 실패 시 에러 상태', async () => {
    let checkCount = 0;
    registry.register('browser', {
      init: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockImplementation(async () => {
        checkCount++;
        return false;
      }),
    });
    await registry.initModule('browser');

    // Run 3 health checks
    await registry.runHealthCheck();
    await registry.runHealthCheck();
    await registry.runHealthCheck();

    const info = registry.get('browser');
    expect(info?.state).toBe('error');
    expect(checkCount).toBe(3);
  });

  it('비활성 모듈 disable 콜백', async () => {
    const callback = vi.fn();
    registry.onDisabled(callback);

    registry.register('browser', {
      init: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue(false),
    });
    await registry.initModule('browser');

    await registry.runHealthCheck();
    await registry.runHealthCheck();
    await registry.runHealthCheck();

    expect(callback).toHaveBeenCalledWith('browser', expect.stringContaining('3회'));
  });

  it('미등록 모듈 initModule은 false', async () => {
    const ok = await registry.initModule('browser');
    expect(ok).toBe(false);
  });

  it('getAll은 모든 모듈 반환', () => {
    registerMockModule(registry, 'browser');
    registerMockModule(registry, 'google');
    expect(registry.getAll().length).toBe(2);
  });
});

// ============================================================================
// SessionContext Tests
// ============================================================================

describe('SessionContextManager', () => {
  let logger: IntegrationLogger;
  let ctx: SessionContextManager;

  beforeEach(() => {
    logger = vi.fn() as IntegrationLogger;
    ctx = new SessionContextManager(logger);
  });

  afterEach(() => {
    ctx.shutdown();
  });

  it('세션 생성 및 조회', () => {
    const session = ctx.getSession('user-1', 'telegram');
    expect(session.userId).toBe('user-1');
    expect(session.channel).toBe('telegram');
  });

  it('히스토리 추가', () => {
    ctx.addEntry('user-1', 'telegram', {
      module: 'browser',
      action: 'search',
      summary: 'Google 검색',
    });
    const history = ctx.getHistory('user-1', 'telegram');
    expect(history.length).toBe(1);
    expect(history[0].module).toBe('browser');
  });

  it('히스토리 최대 10개', () => {
    for (let i = 0; i < 15; i++) {
      ctx.addEntry('user-1', 'telegram', {
        module: 'browser',
        action: `action-${i}`,
        summary: `summary-${i}`,
      });
    }
    expect(ctx.getHistory('user-1', 'telegram').length).toBe(10);
  });

  it('모듈별 마지막 결과 조회', () => {
    ctx.addEntry('user-1', 'telegram', { module: 'browser', action: 'a1', summary: 'first' });
    ctx.addEntry('user-1', 'telegram', { module: 'google', action: 'a2', summary: 'mail' });
    ctx.addEntry('user-1', 'telegram', { module: 'browser', action: 'a3', summary: 'last' });

    const last = ctx.getLastResult('user-1', 'telegram', 'browser');
    expect(last?.summary).toBe('last');
  });

  it('세션 클리어', () => {
    ctx.addEntry('user-1', 'telegram', { module: 'browser', action: 'a', summary: 's' });
    ctx.clear('user-1', 'telegram');
    expect(ctx.getHistory('user-1', 'telegram').length).toBe(0);
  });

  it('활성 세션 수', () => {
    ctx.getSession('user-1', 'telegram');
    ctx.getSession('user-2', 'slack');
    expect(ctx.getActiveCount()).toBe(2);
  });

  it('만료 세션 정리', () => {
    ctx.getSession('user-1', 'telegram');
    // Manually expire
    const session = ctx.getSession('user-1', 'telegram');
    (session as { lastActivityAt: string }).lastActivityAt =
      new Date(Date.now() - 31 * 60 * 1000).toISOString();
    const removed = ctx.cleanup();
    expect(removed).toBe(1);
  });
});
