const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { inside, json, manifest, writeJson } = require('./files.cjs');

function checkRollbackBoundaries({ solution, temporary, run }, target, installation, record) {
  const installer = path.join(solution, 'automation/install.cjs');
  record('rollback-boundary', () => {
    const outside = path.join(temporary, 'outside.txt');
    fs.writeFileSync(outside, 'preserve outside target');
    const forged = path.join(temporary, 'forged-manifest.json');
    writeJson(forged, { ...installation, target, files: ['../outside.txt'] });
    const result = run(installer, ['--target', target, '--rollback', forged]);
    assert.notEqual(result.status, 0, 'rollback must reject a manifest path outside target');
    assert.equal(fs.readFileSync(outside, 'utf8'), 'preserve outside target');
  });
  record('rollback-wrong-target', () => {
    const before = manifest(target), forged = path.join(temporary, 'wrong-target.json');
    writeJson(forged, { ...installation, target: path.join(temporary, 'another-target') });
    const result = run(installer, ['--target', target, '--rollback', forged]);
    assert.notEqual(result.status, 0, 'rollback must reject a manifest for another target');
    assert.deepEqual(manifest(target), before);
  });
  record('rollback-modified-file', () => {
    const file = path.join(target, 'run.cjs'), original = fs.readFileSync(file);
    fs.appendFileSync(file, '\n// operator edit\n');
    const before = manifest(target);
    try {
      const result = run(installer, ['--target', target, '--rollback', path.join(target, '.vibe-pilot-manifest.json')]);
      assert.notEqual(result.status, 0, 'rollback must preserve a modified installed file');
      assert.deepEqual(manifest(target), before);
    } finally { fs.writeFileSync(file, original); }
  });
}

function checkInstallation(context, record) {
  const { solution, temporary, run, checkRun } = context;
  const target = path.join(temporary, 'installed');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'unrelated.txt'), 'retain this file');
  let installation;
  record('installation', () => {
    const result = run(path.join(solution, 'automation/install.cjs'), ['--target', target]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    installation = JSON.parse(result.stdout);
    assert.equal(path.resolve(installation.target), target);
    assert.ok(Array.isArray(installation.files) && installation.files.includes('run.cjs'), 'manifest must include installed run.cjs');
    for (const file of installation.files) assert.ok(fs.statSync(inside(target, file)).isFile());
    assert.deepEqual(json(path.join(target, '.vibe-pilot-manifest.json')), installation);
  });
  record('installation-repeat', () => {
    const before = manifest(target);
    const result = run(path.join(solution, 'automation/install.cjs'), ['--target', target]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(manifest(target), before, 'repeated installation must preserve content');
  });
  record('installed-independent', () => {
    fs.renameSync(solution, `${solution}-unavailable`);
    try { checkRun(path.join(target, 'run.cjs')); }
    finally { fs.renameSync(`${solution}-unavailable`, solution); }
  });
  checkRollbackBoundaries(context, target, installation, record);
  record('rollback', () => {
    const result = run(path.join(solution, 'automation/install.cjs'), ['--target', target, '--rollback', path.join(target, '.vibe-pilot-manifest.json')]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(fs.readdirSync(target), ['unrelated.txt'], 'rollback must remove only installed files');
    assert.equal(fs.readFileSync(path.join(target, 'unrelated.txt'), 'utf8'), 'retain this file');
  });
  record('installation-collision', () => {
    fs.writeFileSync(path.join(target, 'run.cjs'), 'user-owned script');
    const result = run(path.join(solution, 'automation/install.cjs'), ['--target', target]);
    assert.notEqual(result.status, 0, 'installation must not overwrite an unrelated existing script');
    assert.equal(fs.readFileSync(path.join(target, 'run.cjs'), 'utf8'), 'user-owned script');
  });
}

module.exports = { checkInstallation };
