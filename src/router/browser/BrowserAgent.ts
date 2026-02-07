/**
 * BrowserAgent - LLM-driven browser automation
 * Opens Chrome with user's profile, navigates pages,
 * extracts content, and performs actions based on LLM decisions.
 */

import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';
import { BrowserManager } from './BrowserManager.js';

const MAX_STEPS = 15;
const ACTION_TIMEOUT_MS = 30_000;
const MAX_CONTENT_LENGTH = 8000;

/** Structured action returned by LLM */
interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'extract' | 'done' | 'error';
  selector?: string;
  url?: string;
  text?: string;
  direction?: 'up' | 'down';
  result?: string;
  reason?: string;
}

/** Page state sent to LLM for decision */
interface PageState {
  url: string;
  title: string;
  content: string;
  links: Array<{ text: string; href: string; index: number }>;
  inputs: Array<{ type: string; name: string; placeholder: string; index: number }>;
  buttons: Array<{ text: string; index: number }>;
}

/** Playwright page interface (minimal) */
interface PlaywrightPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  title(): Promise<string>;
  url(): string;
  content(): Promise<string>;
  click(selector: string, options?: Record<string, unknown>): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  evaluate<T>(fn: string | ((...args: unknown[]) => T)): Promise<T>;
  waitForLoadState(state?: string, options?: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
}

export interface BrowserAgentResult {
  success: boolean;
  data: string;
  steps: number;
  url?: string;
}

export class BrowserAgent {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;
  private browserManager: BrowserManager;

  constructor(
    logger: InterfaceLogger,
    smartRouter: SmartRouterLike,
    browserManager: BrowserManager,
  ) {
    this.logger = logger;
    this.smartRouter = smartRouter;
    this.browserManager = browserManager;
  }

  /** Execute a browser task described in natural language */
  async execute(task: string): Promise<BrowserAgentResult> {
    const context = await this.browserManager.getContext();
    const page = (await (context as unknown as { newPage(): Promise<PlaywrightPage> }).newPage()) as PlaywrightPage;

    try {
      return await this.runLoop(task, page);
    } finally {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  private async runLoop(task: string, page: PlaywrightPage): Promise<BrowserAgentResult> {
    let steps = 0;
    const history: string[] = [];

    // Get initial action from LLM
    let action = await this.planFirstAction(task);

    while (steps < MAX_STEPS) {
      steps++;
      this.logger('info', `브라우저 에이전트 step ${steps}: ${action.type}${action.url ? ` → ${action.url}` : ''}`);

      if (action.type === 'done') {
        return { success: true, data: action.result ?? '작업 완료', steps, url: page.url() };
      }
      if (action.type === 'error') {
        return { success: false, data: action.reason ?? '작업 실패', steps, url: page.url() };
      }

      // Execute action
      const actionResult = await this.executeAction(page, action);
      history.push(`Step ${steps}: ${action.type}${action.url ? `(${action.url})` : action.selector ? `(${action.selector})` : ''} → ${actionResult}`);

      // Extract page state
      const state = await this.extractPageState(page);

      // Ask LLM for next action
      action = await this.decideNextAction(task, state, history);
    }

    // Max steps reached — try to extract whatever we have
    const finalState = await this.extractPageState(page);
    return {
      success: true,
      data: `최대 단계(${MAX_STEPS}) 도달.\n\n현재 페이지: ${finalState.title}\n${finalState.content.slice(0, 2000)}`,
      steps,
      url: page.url(),
    };
  }

  private async planFirstAction(task: string): Promise<BrowserAction> {
    const response = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: SYSTEM_PROMPT,
      prompt: `사용자 요청: "${task}"\n\n첫 번째 브라우저 액션을 JSON으로 반환하세요.`,
    });

    return this.parseAction(response.content);
  }

  private async decideNextAction(
    task: string,
    state: PageState,
    history: string[],
  ): Promise<BrowserAction> {
    const stateStr = this.formatPageState(state);
    const historyStr = history.slice(-5).join('\n');

    const response = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: SYSTEM_PROMPT,
      prompt: [
        `원래 요청: "${task}"`,
        `\n실행 히스토리:\n${historyStr}`,
        `\n현재 페이지 상태:\n${stateStr}`,
        `\n다음 액션을 JSON으로 반환하세요. 정보를 충분히 얻었으면 type:"done"과 result에 요약을 반환하세요.`,
      ].join('\n'),
    });

    return this.parseAction(response.content);
  }

  private async executeAction(page: PlaywrightPage, action: BrowserAction): Promise<string> {
    try {
      switch (action.type) {
        case 'navigate': {
          if (!action.url) return 'URL 없음';
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS });
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          return `이동 완료: ${page.url()}`;
        }
        case 'click': {
          if (!action.selector) return '셀렉터 없음';
          await page.click(action.selector, { timeout: ACTION_TIMEOUT_MS });
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          return `클릭 완료: ${action.selector}`;
        }
        case 'type': {
          if (!action.selector || !action.text) return '셀렉터/텍스트 없음';
          await page.fill(action.selector, action.text);
          return `입력 완료: ${action.text}`;
        }
        case 'scroll': {
          const dir = action.direction === 'up' ? -500 : 500;
          await page.evaluate(`window.scrollBy(0, ${dir})`);
          return `스크롤 ${action.direction ?? 'down'}`;
        }
        case 'extract': {
          return '추출 요청 (페이지 상태에서 확인)';
        }
        default:
          return `알 수 없는 액션: ${action.type}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger('warn', `브라우저 액션 실패: ${msg}`);
      return `실패: ${msg.slice(0, 200)}`;
    }
  }

  private async extractPageState(page: PlaywrightPage): Promise<PageState> {
    const url = page.url();
    const title = await page.title();

    const extracted = await page.evaluate(() => {
      // Extract visible text
      const body = document.body;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const texts: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent ?? '').trim();
        if (text.length > 2) texts.push(text);
      }

      // Extract links
      const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 30).map((a, i) => ({
        text: (a as HTMLAnchorElement).textContent?.trim().slice(0, 80) ?? '',
        href: (a as HTMLAnchorElement).href,
        index: i,
      }));

      // Extract inputs
      const inputs = Array.from(document.querySelectorAll('input, textarea')).slice(0, 10).map((el, i) => ({
        type: (el as HTMLInputElement).type ?? 'text',
        name: (el as HTMLInputElement).name ?? '',
        placeholder: (el as HTMLInputElement).placeholder ?? '',
        index: i,
      }));

      // Extract buttons
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
        .slice(0, 15)
        .map((el, i) => ({
          text: (el as HTMLElement).textContent?.trim().slice(0, 50) ?? '',
          index: i,
        }));

      return {
        content: texts.join(' ').slice(0, 8000),
        links,
        inputs,
        buttons,
      };
    }) as { content: string; links: PageState['links']; inputs: PageState['inputs']; buttons: PageState['buttons'] };

    return {
      url,
      title,
      content: extracted.content.slice(0, MAX_CONTENT_LENGTH),
      links: extracted.links,
      inputs: extracted.inputs,
      buttons: extracted.buttons,
    };
  }

  private formatPageState(state: PageState): string {
    const parts = [
      `URL: ${state.url}`,
      `Title: ${state.title}`,
      `Content (first 2000 chars): ${state.content.slice(0, 2000)}`,
    ];

    if (state.links.length > 0) {
      parts.push(`Links (${state.links.length}):`);
      state.links.slice(0, 15).forEach((l) => parts.push(`  [${l.index}] "${l.text}" → ${l.href}`));
    }
    if (state.inputs.length > 0) {
      parts.push(`Inputs (${state.inputs.length}):`);
      state.inputs.forEach((inp) => parts.push(`  [${inp.index}] ${inp.type} name="${inp.name}" placeholder="${inp.placeholder}"`));
    }
    if (state.buttons.length > 0) {
      parts.push(`Buttons (${state.buttons.length}):`);
      state.buttons.slice(0, 10).forEach((b) => parts.push(`  [${b.index}] "${b.text}"`));
    }

    return parts.join('\n');
  }

  private parseAction(content: string): BrowserAction {
    // Extract JSON from LLM response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { type: 'done', result: content };
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]) as BrowserAction;
      if (!parsed.type) return { type: 'done', result: content };
      return parsed;
    } catch {
      return { type: 'done', result: content };
    }
  }
}

const SYSTEM_PROMPT = `당신은 브라우저 자동화 에이전트입니다.
사용자의 요청을 수행하기 위해 브라우저를 제어합니다.

반드시 JSON 형식으로 다음 액션 하나만 반환하세요:

1. 페이지 이동: {"type":"navigate","url":"https://..."}
2. 클릭: {"type":"click","selector":"CSS 셀렉터"}
3. 텍스트 입력: {"type":"type","selector":"CSS 셀렉터","text":"입력할 텍스트"}
4. 스크롤: {"type":"scroll","direction":"down"}
5. 작업 완료: {"type":"done","result":"결과 요약 텍스트"}
6. 오류: {"type":"error","reason":"실패 이유"}

규칙:
- CSS 셀렉터를 사용하세요 (예: "input[name=q]", "button[type=submit]", "a:nth-of-type(3)")
- 검색이 필요하면 google.com으로 이동하세요
- 정보를 충분히 얻었으면 반드시 type:"done"으로 결과를 반환하세요
- result에는 사용자가 원하는 정보를 한국어로 정리해서 반환하세요
- JSON 외의 텍스트를 포함하지 마세요`;
