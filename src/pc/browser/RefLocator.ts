/**
 * RefLocator — Ref ID → Playwright Locator 변환
 *
 * "e1" → `page.getByRole(role, { name, exact: true })` 변환.
 * nth 처리 (동일 role+name 중복 시), stale ref 감지.
 */

import type { Page, Locator } from 'playwright';
import type { RoleRefMap, RoleRef, PageState, BrowserError } from './types.js';

export class RefLocator {
  /**
   * ref ID를 Playwright Locator로 변환
   *
   * @param page - 대상 페이지
   * @param ref - ref ID (e.g., "e1", "e3")
   * @param state - 현재 페이지 상태 (refs + snapshotVersion)
   * @returns Playwright Locator
   * @throws REF_NOT_FOUND | REF_STALE
   */
  resolve(page: Page, ref: string, state: PageState): Locator {
    const normalizedRef = this.normalizeRef(ref);
    const roleRef = state.roleRefs[normalizedRef];

    if (!roleRef) {
      throw this.createRefError('REF_NOT_FOUND',
        `Ref "${normalizedRef}" not found. Available refs: ${this.listAvailableRefs(state.roleRefs)}`);
    }

    return this.buildLocator(page, roleRef);
  }

  /**
   * 여러 ref를 한번에 해석
   */
  resolveAll(page: Page, refs: string[], state: PageState): Map<string, Locator> {
    const locators = new Map<string, Locator>();
    for (const ref of refs) {
      locators.set(ref, this.resolve(page, ref, state));
    }
    return locators;
  }

  /**
   * ref 형식 정규화: "@e1", "ref=e1", "e1" → "e1"
   */
  normalizeRef(ref: string): string {
    if (ref.startsWith('@')) return ref.slice(1);
    if (ref.startsWith('ref=')) return ref.slice(4);
    return ref;
  }

  /**
   * ref가 stale인지 확인 (현재 snapshotVersion과 비교)
   */
  isStale(
    refSnapshotVersion: number,
    currentSnapshotVersion: number,
  ): boolean {
    return refSnapshotVersion !== currentSnapshotVersion;
  }

  // ──────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────

  /** RoleRef → Playwright Locator 빌드 */
  private buildLocator(page: Page, roleRef: RoleRef): Locator {
    const { role, name, nth } = roleRef;

    let locator: Locator;
    if (name !== undefined) {
      locator = page.getByRole(role as Parameters<Page['getByRole']>[0], {
        name,
        exact: true,
      });
    } else {
      locator = page.getByRole(role as Parameters<Page['getByRole']>[0]);
    }

    if (nth !== undefined) {
      locator = locator.nth(nth);
    }

    return locator;
  }

  /** 사용 가능한 ref ID 목록 (에러 메시지용) */
  private listAvailableRefs(refs: RoleRefMap): string {
    const entries = Object.entries(refs).slice(0, 10);
    const list = entries.map(([id, r]) => `${id}(${r.role}${r.name ? ` "${r.name}"` : ''})`);
    if (Object.keys(refs).length > 10) list.push('...');
    return list.join(', ') || '(none)';
  }

  /** 구조화된 ref 에러 생성 */
  private createRefError(code: BrowserError['error'], message: string): BrowserError & Error {
    const error = new Error(message) as BrowserError & Error;
    error.error = code;
    error.message = message;
    return error;
  }
}
