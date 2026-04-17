/**
 * Stop Notification Hook - Claude Code 작업 종료 시 알림 발송
 *
 * 지원 채널:
 * - Discord (webhook)
 * - Telegram (bot token + chat_id)
 * - Slack (webhook)
 *
 * 환경변수:
 * - DISCORD_WEBHOOK_URL: Discord webhook URL
 * - TELEGRAM_BOT_TOKEN: Telegram bot token
 * - TELEGRAM_CHAT_ID: Telegram chat ID
 * - SLACK_WEBHOOK_URL: Slack webhook URL
 *
 * 설정 파일: .claude/vibe/config.json
 * {
 *   "notifications": {
 *     "onStop": true,
 *     "channels": ["discord", "telegram", "slack"]
 *   }
 * }
 */

import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, VIBE_PATH, readVibeConfig, projectVibePath } from './utils.js';

// Read hook input from stdin
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
}

async function sendDiscord(message, summary) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { sent: false, reason: 'no webhook url' };

  try {
    const payload = {
      embeds: [{
        title: '🔔 Claude Code Task Completed',
        description: summary || 'Task finished',
        color: 5763719, // Green
        fields: [
          { name: 'Project', value: path.basename(PROJECT_DIR) || 'Unknown', inline: true },
          { name: 'Time', value: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), inline: true }
        ],
        footer: { text: 'VIBE Core' },
        timestamp: new Date().toISOString()
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { sent: response.ok, reason: response.ok ? 'success' : `HTTP ${response.status}` };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

async function sendTelegram(message, summary) {
  const vibeConfig = readVibeConfig();
  const botToken = vibeConfig.channels?.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = vibeConfig.channels?.telegram?.allowedChatIds || [];
  const chatId = chatIds[0] || process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return { sent: false, reason: 'no token or chat_id' };

  try {
    const text = `🔔 *Claude Code Task Completed*\n\n` +
      `📁 Project: \`${path.basename(PROJECT_DIR) || 'Unknown'}\`\n` +
      `⏰ Time: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n\n` +
      (summary ? `📝 ${summary}` : '');

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    return { sent: result.ok, reason: result.ok ? 'success' : result.description };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

async function sendSlack(message, summary) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return { sent: false, reason: 'no webhook url' };

  try {
    const payload = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🔔 Claude Code Task Completed', emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Project:*\n${path.basename(PROJECT_DIR) || 'Unknown'}` },
            { type: 'mrkdwn', text: `*Time:*\n${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` }
          ]
        }
      ]
    };

    if (summary) {
      payload.blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Summary:*\n${summary}` }
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { sent: response.ok, reason: response.ok ? 'success' : `HTTP ${response.status}` };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

async function main() {
  // Parse input
  let stopReason = '';
  let summary = '';
  try {
    const data = JSON.parse(input);
    stopReason = data.stop_reason || data.stopReason || '';
    summary = data.summary || data.message || '';
  } catch {
    // Not JSON, use as-is
    summary = input.trim();
  }

  // Load config
  let config = { notifications: { onStop: true, channels: ['discord', 'telegram', 'slack'] } };
  const configPath = projectVibePath(PROJECT_DIR, 'config.json');

  try {
    if (fs.existsSync(configPath)) {
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (rawConfig.notifications) {
        config.notifications = { ...config.notifications, ...rawConfig.notifications };
      }
    }
  } catch { /* use defaults */ }

  // Check if notifications enabled
  if (!config.notifications.onStop) {
    console.log('[Stop Notify] Notifications disabled');
    return;
  }

  const channels = config.notifications.channels || ['discord', 'telegram', 'slack'];
  const results = [];

  // Send notifications in parallel
  const promises = [];

  if (channels.includes('discord')) {
    promises.push(sendDiscord(stopReason, summary).then(r => results.push({ channel: 'discord', ...r })));
  }

  if (channels.includes('telegram')) {
    promises.push(sendTelegram(stopReason, summary).then(r => results.push({ channel: 'telegram', ...r })));
  }

  if (channels.includes('slack')) {
    promises.push(sendSlack(stopReason, summary).then(r => results.push({ channel: 'slack', ...r })));
  }

  await Promise.all(promises);

  // Log results
  const sent = results.filter(r => r.sent);
  const failed = results.filter(r => !r.sent);

  if (sent.length > 0) {
    console.log(`[Stop Notify] Sent to: ${sent.map(r => r.channel).join(', ')}`);
  }

  if (failed.length > 0 && failed.some(r => channels.includes(r.channel))) {
    // Only log failures for explicitly configured channels with valid credentials
    const relevantFailures = failed.filter(r =>
      r.reason !== 'no webhook url' && r.reason !== 'no token or chat_id'
    );
    if (relevantFailures.length > 0) {
      console.log(`[Stop Notify] Failed: ${relevantFailures.map(r => `${r.channel} (${r.reason})`).join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error('[Stop Notify] Error:', err.message);
});
