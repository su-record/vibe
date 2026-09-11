import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { answer, openQuestions } from '../dist/core/inbox.js';

/** The same task-owned fake user answers inbox questions and either client's final message. */
export function answerQuestions(ws, script, finalText) {
  const questions = openQuestions(ws).filter((q) => !q.answer).map((q) => ({ id: q.id, text: q.question }));
  if (finalText) questions.push({ id: null, text: finalText });
  let answered = 0;
  for (const q of questions) {
    const result = spawnSync('node', [script], { input: q.text, encoding: 'utf-8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`fake user ${script} exited ${result.status}: ${result.stderr}`);
    const text = result.stdout.trim();
    if (!text) continue;
    answered += 1;
    const directory = path.join(ws, 'customer');
    const file = path.join(directory, 'answers.json');
    fs.mkdirSync(directory, { recursive: true });
    const delivered = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { answers: [] };
    delivered.answers.push({ question: q.text, answer: text });
    fs.writeFileSync(file, `${JSON.stringify(delivered, null, 2)}\n`);
    fs.appendFileSync(path.join(ws, 'TASK.md'), `\n\nAnswer from the user, to what you asked: ${text}\nDelivered replies are recorded in customer/answers.json.\n`);
    if (q.id) answer(ws, q.id, text);
  }
  return answered;
}

/** A recorded question still needs the user, and none of the task's declared outputs exists. */
export function stalled(ws, outputs = []) {
  return outputs.length > 0 && outputs.every((file) => !fs.existsSync(path.join(ws, file)))
    && openQuestions(ws).some((q) => !q.answer);
}
