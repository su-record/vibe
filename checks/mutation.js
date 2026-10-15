// Mutation check: Stryker changes the listed code one small piece at a time (flips a condition,
// empties a string, drops a statement) and every such change must make a test fail. A change no
// test notices is a bug the tests would also miss. A new target is one more TARGETS entry.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Stryker } from '@stryker-mutator/core';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);

/** `file:first-last`: the lines from the one holding `from` through the next one holding `to`, found by text so an edit above cannot shift the range onto other code. */
function span(file, from, to) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const first = lines.findIndex(line => line.includes(from));
  const last = lines.findIndex((line, index) => index >= first && line.includes(to));
  if (first < 0 || last < 0) throw new Error(`${file}: cannot find the lines from "${from}" to "${to}"`);
  return `${file}:${first + 1}-${last + 1}`;
}

// The hooks run as separate processes, where the vitest runner cannot switch a mutant on. The command
// runner passes the active mutant through the environment, which the spawned hook inherits.
const TARGETS = [
  {
    name: 'guide dispatch and note priority',
    mutate: [
      'src/cli/internal.ts',
      span('src/core/context-notes.ts', 'const PRIORITY =', 'const PRIORITY ='),
      span('src/core/context-notes.ts', 'function ordering(', 'a.localeCompare(b)'),
    ],
    testRunner: 'vitest', coverageAnalysis: 'perTest',
  },
  {
    name: 'Codex session line',
    mutate: [
      span('hooks/session-state.cjs', 'function overview(root)', 'catch { return null; }'),
      span('hooks/session.js', 'const line =', 'process.stdout.write('),
    ],
    testRunner: 'command',
    commandRunner: { command: 'npx vitest run src/core/session.test.ts -t "Codex one recorded-state line"' },
  },
];
const MISSED = ['Survived', 'NoCoverage'];
const INVALID = ['CompileError', 'RuntimeError', 'Ignored'];

let missed = 0;
for (const { name, ...options } of TARGETS) {
  const results = await new Stryker({
    ...options, reporters: [], plugins: ['@stryker-mutator/vitest-runner'], concurrency: 3, timeoutMS: 60000,
    tempDirName: '.stryker-tmp', cleanTempDir: 'always', logLevel: 'error',
  }).runMutationTest();
  const valid = results.filter(mutant => !INVALID.includes(mutant.status));
  const escaped = valid.filter(mutant => MISSED.includes(mutant.status));
  if (valid.length === 0) throw new Error(`${name}: no mutant was made, so nothing was tested`);
  console.log(`${name}: ${valid.length - escaped.length}/${valid.length} mutants caught`);
  for (const mutant of escaped) {
    const at = `${path.relative(root, mutant.fileName)}:${mutant.location.start.line}:${mutant.location.start.column + 1}`;
    console.error(`  ${mutant.status} ${at} ${mutant.mutatorName} → ${mutant.replacement.replace(/\s+/g, ' ').slice(0, 120)}`);
  }
  missed += escaped.length;
}
if (missed > 0) {
  console.error(`${missed} mutants escaped the tests`);
  process.exit(1);
}
