/**
 * CLI 명령어 모듈
 *
 * 관심사별 모듈 분리:
 * - init: init 명령어 + Cursor 에셋 업데이트
 * - update: update 명령어
 * - remove: remove 명령어
 * - info: help, status, version
 */

export { init, updateCursorGlobalAssets } from './init.js';
export { update, checkAndUpgradeVibe } from './update.js';
export { remove } from './remove.js';
export { showHelp, showStatus, showVersion } from './info.js';
