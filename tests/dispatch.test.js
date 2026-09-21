const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');
const HOOK = path.join(__dirname, '..', 'hooks', 'dispatch.js');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));
// One program serves every event. PROSE_LINT_HOME moves the logs and the state, and the judge is off.
function run(input, home, extra = {}) {
  const r = spawnSync(process.execPath, [HOOK], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home, PROSE_LINT_HOME: home, PROSE_LINT_NO_JEV: '1', ...extra } });
  const rows = f => fs.existsSync(path.join(home, f)) ? fs.readFileSync(path.join(home, f), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  return { r, rows, out: r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null };
}
const write = (file_path, content) => ({ hook_event_name: 'PostToolUse', tool_name: 'Write', session_id: 's', tool_input: { file_path, content } });
const commit = msg => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', session_id: 's', cwd: '/w', tool_input: { command: `git commit -m "${msg}"` } });
const stop = (text, cwd = '/w/proj') => ({ hook_event_name: 'Stop', session_id: 's', cwd, last_assistant_message: text });

test('a file write gets the short message by default, and the log says the plugin wrote it', () => {
  const home = tmpdir(); const { out, rows } = run(write('/w/design/report.md', 'Fine words.\n\nThis check is load-bearing now.\n'), home);
  assert.equal(out.hookEventName, 'PostToolUse');
  assert.match(out.additionalContext, /^prose-lint report\.md: 1 to fix\nL3 PH "load-bearing"\nPH banned phrase/);
  assert.equal(rows('writes.jsonl')[0].findings.length, 1);
});

test('the long message is sent when the option asks for it', () => {
  const { out } = run(write('/w/report.md', 'This check is load-bearing now.'), tmpdir(), { CLAUDE_PLUGIN_OPTION_MESSAGE_FORMAT: 'long' });
  assert.match(out.additionalContext, /\/w\/report\.md:1  phrase/);
});

test('each piece can be turned off by its option', () => {
  const home = tmpdir();
  assert.equal(run(write('/w/a.md', 'This is load-bearing.'), home, { CLAUDE_PLUGIN_OPTION_WRITE_FEEDBACK: 'false' }).r.stdout, '');
  assert.equal(run(commit('This is load-bearing.'), home, { CLAUDE_PLUGIN_OPTION_COMMIT_CHECK: 'off' }).r.stdout, '');
  run(stop('This is load-bearing.'), home, { CLAUDE_PLUGIN_OPTION_REPLY_LOG: 'false' });
  assert.deepEqual([fs.existsSync(path.join(home, 'writes.jsonl')), fs.existsSync(path.join(home, 'commits.jsonl')), fs.existsSync(path.join(home, 'chat.jsonl'))], [false, false, false]);
});

test('a commit is denied once in the short form, and passed the second time', () => {
  const home = tmpdir(); const first = run(commit('The list is load-bearing for task 3.'), home);
  assert.equal(first.out.permissionDecision, 'deny'); assert.match(first.out.permissionDecisionReason, /L1 PH "load-bearing"/); assert.match(first.out.permissionDecisionReason, /did not run/);
  assert.equal(run(commit('The list is load-bearing for task 3.'), home).r.stdout, '');
  assert.deepEqual(first.rows('commits.jsonl').map(r => r.decision), ['deny', 'kept']);
});

test('your own rules file changes what the hooks find', () => {
  const home = tmpdir(); fs.writeFileSync(path.join(home, 'rules.local.json'), JSON.stringify({ phrases: [{ re: 'moving forward', alt: 'cut it', example: 'Moving forward, we test.' }] }));
  assert.match(run(write('/w/a.md', 'Moving forward, we test more.'), home).out.additionalContext, /PH "moving forward"/);
});

test('a session start gives a short report of recent replies in the same project, from the reply log', () => {
  const home = tmpdir(); const now = Date.now(); const rows = [];
  for (let i = 0; i < 6; i++) rows.push({ ts: new Date(now - i * 3600e3).toISOString(), event: 'Stop', session: 'a', cwd: '/w/proj', sentences: 10, findings: [{ rule: 'thing_acts', kind: 'judge', score: 0.7 + i / 100, sentence: `Sentence ${i} carries the thing.` }, { rule: 'long-sentence', kind: 'hit', sentence: 'Long one.' }] });
  rows.push({ ts: new Date(now - 3600e3).toISOString(), event: 'Stop', session: 'b', cwd: '/other', sentences: 50, findings: [{ rule: 'em-dash', kind: 'hit', sentence: 'x — y' }] });
  rows.push({ ts: new Date(now - 30 * 86400e3).toISOString(), event: 'Stop', session: 'c', cwd: '/w/proj', sentences: 99, findings: [{ rule: 'phrase', kind: 'hit', sentence: 'old' }] });
  fs.writeFileSync(path.join(home, 'chat.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  const { out } = run({ hook_event_name: 'SessionStart', source: 'startup', session_id: 'n', cwd: '/w/proj' }, home);
  assert.equal(out.hookEventName, 'SessionStart');
  assert.match(out.additionalContext, /last 6 replies/); assert.match(out.additionalContext, /TP 6/); assert.match(out.additionalContext, /LS 6/);
  assert.match(out.additionalContext, /"Sentence 5 carries the thing\."/, 'the example is the one with the highest score');
  assert.doesNotMatch(out.additionalContext, /ED|PH /, 'another project and an old reply are left out');
  assert.ok(out.additionalContext.length < 400);
});

test('a session start says nothing when the project has few replies, when it is off, or when replies were clean', () => {
  const home = tmpdir(); fs.writeFileSync(path.join(home, 'chat.jsonl'), JSON.stringify({ ts: new Date().toISOString(), cwd: '/w/proj', sentences: 3, findings: [] }) + '\n');
  assert.equal(run({ hook_event_name: 'SessionStart', cwd: '/w/proj' }, home).r.stdout, '');
  assert.equal(run({ hook_event_name: 'SessionStart', cwd: '/w/proj' }, tmpdir()).r.stdout, '');
});

test('an event it does not know, and bad input, are passed without a word', () => {
  for (const i of ['not json', { hook_event_name: 'PreCompact' }]) { const { r } = run(i, tmpdir()); assert.equal(r.status, 0); assert.equal(r.stdout, ''); }
});
