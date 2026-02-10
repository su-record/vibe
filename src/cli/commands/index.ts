/**
 * CLI 명령어 모듈
 *
 * 사용자 명령어만 노출. 내부 시스템(sentinel, evolution, policy, hud 등)은
 * hooks/알림 채널이 자동 처리하므로 CLI에서 제거.
 */

export { init, updateCursorGlobalAssets } from './init.js';
export { setup } from './setup.js';
export { update, checkAndUpgradeVibe } from './update.js';
export { remove } from './remove.js';
export { showHelp, showStatus, showVersion } from './info.js';
export { syncLogin, syncPush, syncPull, syncStatus, syncLogout } from './sync.js';
export { daemonStart, daemonStop, daemonRestart } from './daemon.js';
export { telegramSetup, telegramChat, telegramStatus, telegramHelp } from './telegram.js';
export { slackSetup, slackChannel, slackStatus, slackHelp } from './slack.js';
// start/stop 내부 사용
export { interfaceEnableConfigured, interfaceDisableAll } from './interface.js';
export { autostartEnable, autostartDisable } from './autostart.js';
