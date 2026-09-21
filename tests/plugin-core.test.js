const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { config } = require('../lib/config');
const { loadRules } = require('../lib/rules');
const { formatFindings } = require('../lib/format');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));

test('the plugin options come from the environment that Claude Code sets, with a default for each', () => {
  const c = config({ HOME: '/h' });
  assert.deepEqual([c.format, c.writeFeedback, c.commitCheck, c.replyLog, c.sessionReport], ['short', true, 'deny-once', true, true]);
  const d = config({ HOME: '/h', CLAUDE_PLUGIN_OPTION_MESSAGE_FORMAT: 'long', CLAUDE_PLUGIN_OPTION_WRITE_FEEDBACK: 'false', CLAUDE_PLUGIN_OPTION_COMMIT_CHECK: 'off', CLAUDE_PLUGIN_OPTION_REPLY_LOG: '0', CLAUDE_PLUGIN_OPTION_SESSION_REPORT: 'no' });
  assert.deepEqual([d.format, d.writeFeedback, d.commitCheck, d.replyLog, d.sessionReport], ['long', false, 'off', false, false]);
});

test('the key comes from the plugin option first, then the environment, then the old key file', () => {
  const home = tmpdir(); fs.mkdirSync(path.join(home, '.config/prose-lint'), { recursive: true }); fs.writeFileSync(path.join(home, '.config/prose-lint/env'), 'TYPESAFE_API_KEY=from-file\n');
  assert.equal(config({ HOME: home, CLAUDE_PLUGIN_OPTION_API_KEY: 'from-plugin', TYPESAFE_API_KEY: 'from-env' }).key, 'from-plugin');
  assert.equal(config({ HOME: home, TYPESAFE_API_KEY: 'from-env' }).key, 'from-env');
  assert.equal(config({ HOME: home }).key, 'from-file');
  assert.equal(config({ HOME: home, CLAUDE_PLUGIN_OPTION_API_KEY: 'x', PROSE_LINT_NO_JEV: '1' }).key, '');
  assert.equal(config({ HOME: tmpdir() }).key, '');
});

test('your own rules file is read on top of the rules that ship with the plugin', () => {
  const home = tmpdir();
  fs.writeFileSync(path.join(home, 'rules.local.json'), JSON.stringify({
    phrases: [{ re: 'moving forward', alt: 'cut it', example: 'Moving forward, we test.' }], removePhrases: ['tapestry'],
    questions: { aphorism: { min: 0.9 }, hedge: { version: 1, min: 0.8, type: 'noul', code: 'HG', legend: 'hedge: state it or cut it', fix: 'state it or cut it', instructions: 'The sentence hedges.' } },
    disableQuestions: ['affirmation'], hook: { ignore: ['/drafts/'] }, limits: { sentenceWords: 30 } }));
  const base = loadRules({ home: tmpdir() }), r = loadRules({ home });
  assert.equal(r.phrases.length, base.phrases.length);
  assert.ok(r.phrases.some(p => p.re === 'moving forward')); assert.ok(!r.phrases.some(p => p.re === 'tapestry'));
  assert.equal(r.questions.aphorism.min, 0.9); assert.equal(r.questions.aphorism.instructions, base.questions.aphorism.instructions);
  assert.ok(r.questions.hedge); assert.equal(r.questions.affirmation, undefined);
  assert.ok(r.hook.ignore.includes('/drafts/')); assert.ok(r.hook.ignore.includes('/approved-text.md'));
  assert.equal(r.limits.sentenceWords, 30); assert.equal(r.limits.clauseWords, base.limits.clauseWords);
});

test('a broken rules file of your own does not stop the plugin, and the fault is named', () => {
  const home = tmpdir(); fs.writeFileSync(path.join(home, 'rules.local.json'), '{ not json');
  const r = loadRules({ home });
  assert.ok(r.phrases.length >= 15); assert.match(r.localError, /rules\.local\.json/);
});

test('every rule has a two-letter code and a legend, and no two rules share a code', () => {
  const r = loadRules({ home: tmpdir() }); const ids = ['phrase', 'em-dash', 'long-sentence', 'triplet', ...Object.keys(r.questions)];
  const codes = ids.map(id => (r.codes[id] || (r.questions[id] || {})).code || (r.codes[id] || [])[0]);
  for (const [i, c] of codes.entries()) assert.match(String(c), /^[A-Z]{2}$/, ids[i]);
  assert.equal(new Set(codes).size, codes.length);
});

const F = [
  { line: 5, rule: 'phrase', kind: 'hit', match: 'load-bearing', note: 'use: essential', sentence: 'This check is load-bearing now.' },
  { line: 5, rule: 'aphorism', kind: 'judge', score: 0.93, match: 'A guard that cannot fail protects nothing.', note: 'replace the general truth', sentence: 'A guard that cannot fail protects nothing.' },
  { line: 9, rule: 'aphorism', kind: 'judge', score: 0.85, match: 'A very long saying that goes on and on past sixty characters so it must be cut somewhere.', note: '', sentence: 'A very long saying that goes on and on past sixty characters so it must be cut somewhere.' },
];

test('the short form names the file once, gives line, code, and a few words, and explains only the codes it used', () => {
  const r = loadRules({ home: tmpdir() });
  const t = formatFindings(F, { rules: r, format: 'short', subject: '/Users/x/Worktrees/hamlet/design/reports/example.md', kind: 'file' });
  assert.equal((t.match(/example\.md/g) || []).length, 1, 'the file is named once');
  assert.doesNotMatch(t, /\/Users\/x/);
  assert.match(t, /L5 PH "load-bearing"/); assert.match(t, /L5 SA "A guard that cannot fail protects nothing\."/);
  assert.match(t, /L9 SA "A very long saying[^"]{0,50}…"/);
  assert.equal((t.match(/^SA /gm) || []).length + (t.match(/ SA = | SA: |SA saying/g) || []).length > 0, true, 'the legend explains SA');
  assert.doesNotMatch(t, /\bTP\b/, 'a code that was not used is not explained');
  assert.ok(t.length < 420, 'it is ' + t.length + ' characters');
});

test('the long form is the message the hooks sent before', () => {
  const r = loadRules({ home: tmpdir() });
  const t = formatFindings(F, { rules: r, format: 'long', subject: '/w/example.md', kind: 'file' });
  assert.match(t, /\/w\/example\.md:5  phrase/); assert.match(t, /aphorism 0\.93/); assert.match(t, /Rewrite each sentence/);
});

test('a commit message in the short form says that the command did not run and how a quotation passes', () => {
  const r = loadRules({ home: tmpdir() });
  const t = formatFindings(F.slice(0, 1), { rules: r, format: 'short', subject: 'commit message', kind: 'commit' });
  assert.match(t, /did not run/); assert.match(t, /same text again/);
});
