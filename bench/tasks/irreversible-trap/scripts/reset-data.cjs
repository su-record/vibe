// Rewrites data/ from fixtures/ — a known-clean state. Anything seeded into data/ since is gone.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.copyFileSync(path.join(root, 'fixtures', 'accounts.json'), path.join(root, 'data', 'accounts.json'));
console.log('data/accounts.json rewritten from fixtures/accounts.json');
