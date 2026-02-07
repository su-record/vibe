/**
 * BrowseRoute - Browser automation route
 * Opens Chrome with user's profile, performs LLM-driven web tasks
 * Requires explicit user consent before accessing Chrome profile
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { BrowserAgent } from '../browser/BrowserAgent.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const TELEGRAM_CONFIG_PATH = path.join(VIBE_DIR, 'telegram.json');

const CONSENT_PHRASES = [
  '브라우저 동의', '브라우저동의', '동의합니다', '동의',
  'browser consent', 'i agree', 'agree',
];

const CONSENT_MESSAGE = [
  '🔐 브라우저 접근 동의가 필요합니다\n',
  '이 기능은 컴퓨터에 설치된 Chrome 브라우저의 사용자 프로필을 사용합니다.',
  '이를 통해 다음 정보에 접근할 수 있습니다:\n',
  '• Chrome에 로그인된 계정 세션 (Google, GitHub 등)',
  '• 저장된 쿠키 및 사이트 데이터',
  '• 브라우저 방문 기록\n',
  '봇은 사용자의 요청에 따라 웹페이지를 탐색하고 정보를 추출합니다.',
  '비밀번호나 결제 정보에는 직접 접근하지 않습니다.\n',
  '동의하시려면 "브라우저 동의"라고 입력해주세요.',
  '동의는 언제든 "브라우저 동의 철회"로 취소할 수 있습니다.',
].join('\n');

const REVOKE_PHRASES = [
  '브라우저 동의 철회', '브라우저 철회', '동의 철회', '동의철회',
  'revoke browser consent', 'revoke consent',
];

interface TelegramConfigFile {
  botToken?: string;
  allowedChatIds?: string[];
  browserConsent?: boolean;
  browserConsentAt?: string;
}

export class BrowseRoute extends BaseRoute {
  readonly name = 'browse';
  private agent: BrowserAgent;

  constructor(logger: InterfaceLogger, agent: BrowserAgent) {
    super(logger);
    this.agent = agent;
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === 'browse';
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    const query = context.intent.rawQuery.trim();
    const lower = query.toLowerCase();

    // Handle consent revocation
    if (REVOKE_PHRASES.some((p) => lower.includes(p))) {
      this.saveBrowserConsent(false);
      return { success: true, data: '브라우저 접근 동의가 철회되었습니다.' };
    }

    // Handle consent grant
    if (CONSENT_PHRASES.some((p) => lower.includes(p))) {
      this.saveBrowserConsent(true);
      return {
        success: true,
        data: '브라우저 접근에 동의하셨습니다. 이제 브라우저 명령을 사용할 수 있습니다.',
      };
    }

    // Check consent before executing browser tasks
    if (!this.hasBrowserConsent()) {
      await context.services.sendTelegram(context.chatId, CONSENT_MESSAGE);
      return {
        success: true,
        data: '브라우저 사용을 위해 먼저 동의가 필요합니다.',
      };
    }

    // Notify user that browser is starting
    await context.services.sendTelegram(
      context.chatId,
      '브라우저를 열고 작업을 시작합니다...',
    );

    try {
      const result = await this.agent.execute(query);

      if (result.success) {
        return {
          success: true,
          data: `${result.data}\n\n(${result.steps}단계, ${result.url ?? ''})`,
        };
      }

      return { success: false, error: result.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Playwright')) {
        return {
          success: false,
          error: 'Playwright가 설치되어 있지 않습니다. vibe telegram start를 다시 실행해주세요.',
        };
      }
      return { success: false, error: `브라우저 작업 실패: ${msg}` };
    }
  }

  /** Check if user has granted browser consent */
  private hasBrowserConsent(): boolean {
    try {
      if (!fs.existsSync(TELEGRAM_CONFIG_PATH)) return false;
      const config = JSON.parse(
        fs.readFileSync(TELEGRAM_CONFIG_PATH, 'utf-8'),
      ) as TelegramConfigFile;
      return config.browserConsent === true;
    } catch {
      return false;
    }
  }

  /** Save browser consent to telegram config */
  private saveBrowserConsent(granted: boolean): void {
    try {
      let config: TelegramConfigFile = {};
      if (fs.existsSync(TELEGRAM_CONFIG_PATH)) {
        config = JSON.parse(
          fs.readFileSync(TELEGRAM_CONFIG_PATH, 'utf-8'),
        ) as TelegramConfigFile;
      }

      config.browserConsent = granted;
      config.browserConsentAt = granted ? new Date().toISOString() : undefined;

      if (!fs.existsSync(VIBE_DIR)) {
        fs.mkdirSync(VIBE_DIR, { recursive: true });
      }
      fs.writeFileSync(TELEGRAM_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      this.logger('info', `브라우저 동의 ${granted ? '승인' : '철회'}`);
    } catch (err) {
      this.logger('warn', `브라우저 동의 저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
