const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { lint } = require('../lib/lint');
const rules = require('../rules.json');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));
// The network edge, faked: a clause that holds "carries" scores 0.9 on thing_acts, and all else scores 0.1.
const fake = calls => async (url, init) => { const b = JSON.parse(init.body); calls.push(b.state.sentence); const answers = {};
  for (const id of Object.keys(b.questions)) answers[id] = { noul: id === 'thing_acts' && /carries/.test(b.state.sentence) ? 0.9 : 0.1 };
  return { ok: true, status: 200, json: async () => ({ answers, usage: { input_tokens: 10 } }) }; };

test('offline only: hits and hints come back with the line and the sentence', async () => {
  const r = await lint('Plain words are here now.\n\nThe soak carries the oracle — always.', { rules, jev: false });
  assert.equal(r.jev, 'off');
  assert.deepEqual(r.findings.map(f => [f.line, f.rule, f.kind]), [[3, 'em-dash', 'hit'], [3, 'thing-acts', 'hint']]);
  assert.equal(r.findings[0].sentence, 'The soak carries the oracle — always.');
});

test('with the judge: a confirmed pattern is a finding with its score, and the hint it replaces is gone', async () => {
  const r = await lint('The soak carries the oracle.', { rules, jev: true, key: 'K', fetch: fake([]), cacheFile: path.join(tmpdir(), 'c.json') });
  assert.equal(r.jev, 'ran');
  assert.deepEqual(r.findings.map(f => [f.rule, f.kind, f.score]), [['thing_acts', 'judge', 0.9]]);
});

test('with the judge: a hint the judge rejects is dropped', async () => {
  const r = await lint('Esk will carry the wood to the fire.', { rules, jev: true, key: 'K', fetch: fake([]), cacheFile: path.join(tmpdir(), 'c.json') });
  assert.deepEqual(r.findings, []);
});

test('a long sentence is judged by its best clause', async () => {
  const calls = [];
  const long = 'The oracle is gated by a flag that nobody sets in the long run, and the flag needs the default length; so the default soak carries the oracle.';
  const r = await lint(long, { rules, jev: true, key: 'K', fetch: fake(calls), cacheFile: path.join(tmpdir(), 'c.json') });
  assert.ok(calls.length >= 3, 'clauses were sent: ' + calls.length);
  const f = r.findings.find(f => f.rule === 'thing_acts');
  assert.equal(f.score, 0.9);
  assert.equal(f.match, 'so the default soak carries the oracle.');
});

test('when the judge cannot run, the hints stay and the result says why', async () => {
  const r = await lint('The soak carries the oracle.', { rules, jev: true, key: '', cacheFile: path.join(tmpdir(), 'c.json') });
  assert.match(r.jev, /no key/);
  assert.deepEqual(r.findings.map(f => f.kind), ['hint']);
});

const BIN = path.join(__dirname, '..', 'bin', 'prose-lint');
test('the command reads a file, names file and line, and exits 1 on a finding', () => {
  const f = path.join(tmpdir(), 'a.md'); fs.writeFileSync(f, 'Fine words are here.\n\nThis check is load-bearing now.\n');
  const r = spawnSync(process.execPath, [BIN, '--no-jev', f], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(f.replace(/[.\\/]/g, '\\$&') + ':3\\s+phrase'));
  assert.match(r.stdout, /judge: off/);
});

test('the command reads stdin, gives JSON, and exits 0 when clean', () => {
  const out = execFileSync(process.execPath, [BIN, '--no-jev', '--json'], { input: 'Run the soak after every change.', encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), { jev: 'off', tokens: 0, files: [{ file: '<stdin>', findings: [] }] });
});

test('a banned phrase in a heading or a table cell is a hit, though neither is judged as a sentence', async () => {
  const calls = [];
  const r = await lint('## One red, a real gap in G4\n\n| file | note |\n|---|---|\n| a.js | This cell is load-bearing, faster, cleaner, and simpler. |\n', { rules, jev: true, key: 'K', fetch: fake(calls), cacheFile: path.join(tmpdir(), 'c.json') });
  assert.deepEqual(r.findings.map(f => [f.line, f.rule, f.match]), [[1, 'phrase', 'a real gap'], [5, 'phrase', 'load-bearing']]);
  assert.equal(calls.length, 0, 'no heading and no cell goes to the judge');
});
