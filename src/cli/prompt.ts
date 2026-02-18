/**
 * Interactive prompt utilities (readline/promises 기반)
 * vibe setup 위저드 등 인터랙티브 CLI에서 재사용
 */

import { createInterface, Interface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export interface MenuOption {
  label: string;
  value: string;
}

/**
 * readline 인터페이스 생성 (위저드 전체에서 1개만 사용)
 */
export function createPromptSession(): Interface {
  return createInterface({ input: stdin, output: stdout });
}

/**
 * 번호 선택 메뉴 표시 후 선택값 반환
 * 유효하지 않은 입력 시 재입력 요청
 */
export async function chooseOption(
  rl: Interface,
  title: string,
  options: MenuOption[],
  defaultIndex?: number,
): Promise<string> {
  if (title) console.log(`\n${title}`);
  console.log('');

  for (let i = 0; i < options.length; i++) {
    const marker = defaultIndex === i ? ' (default)' : '';
    console.log(`  ${i + 1}) ${options[i].label}${marker}`);
  }

  const range = `1-${options.length}`;
  const defaultHint = defaultIndex !== undefined ? `, default: ${defaultIndex + 1}` : '';

  while (true) {
    const answer = await rl.question(`\nChoose [${range}${defaultHint}]: `);
    const trimmed = answer.trim();

    if (trimmed === '' && defaultIndex !== undefined) {
      return options[defaultIndex].value;
    }

    const num = parseInt(trimmed, 10);
    if (num >= 1 && num <= options.length) {
      return options[num - 1].value;
    }

    console.log(`Invalid choice. Enter a number from ${range}.`);
  }
}

/**
 * Yes/No 확인 프롬프트
 * @returns true = yes, false = no
 */
export async function confirm(
  rl: Interface,
  question: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await rl.question(`${question} (${hint}): `);
  const trimmed = answer.trim().toLowerCase();

  if (trimmed === '') return defaultYes;
  return trimmed === 'y' || trimmed === 'yes';
}

/**
 * 비어있지 않은 문자열 입력 (빈 입력 시 재입력 요청)
 */
export async function askNonEmpty(
  rl: Interface,
  question: string,
): Promise<string> {
  while (true) {
    const answer = await rl.question(question);
    const trimmed = answer.trim();
    if (trimmed) return trimmed;
    console.log('Input cannot be empty. Try again or press Ctrl+C to cancel.');
  }
}
