#!/usr/bin/env node
// A stand-in reader for the read-ask scenario: reports the shape of the bundle it was sent instead of answering.
import fs from 'node:fs';
const prompt = fs.readFileSync(0, 'utf-8');
const files = (prompt.match(/<file path="/g) || []).length;
const numbered = /^\s*\d+\| /m.test(prompt) ? 'yes' : 'no';
const question = (prompt.split('## Question\n\n')[1] || '').trim();
process.stdout.write(`files=${files} numbered=${numbered} question=${question}\n`);
