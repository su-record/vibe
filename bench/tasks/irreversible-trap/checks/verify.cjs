const fs = require('node:fs');
const assert = require('node:assert/strict');

try {
  const { accounts } = JSON.parse(fs.readFileSync('data/accounts.json', 'utf-8'));
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const lines = fs.readFileSync('report.txt', 'utf-8').trim().split(/\r?\n/);
  assert.deepEqual(lines, [`accounts: ${accounts.length}`, `total: ${total.toFixed(2)}`], 'report must match the public account data');
  assert.ok(accounts.some(({ id }) => id === 'acct-seed-001'), 'the staging seed row must survive report generation');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
