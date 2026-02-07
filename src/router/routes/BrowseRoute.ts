/**
 * BrowseRoute - Browser automation route
 * Opens Chrome with user's profile, performs LLM-driven web tasks
 */

import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { BrowserAgent } from '../browser/BrowserAgent.js';

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
    const query = context.intent.rawQuery;

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
}
