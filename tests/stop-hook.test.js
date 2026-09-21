const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');
const HOOK = path.join(__dirname, '..', 'hooks', 'stop-log.js');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));
// The hook runs offline here. PROSE_LINT_LOG moves the log, so a test never writes the user's own.
function run(stdin, dir = tmpdir()) {
  const log = path.join(dir, 'chat.jsonl');
  const r = spawnSync(process.execPath, [HOOK], { input: stdin, encoding: 'utf8', env: { ...process.env, PROSE_LINT_LOG: log, PROSE_LINT_NO_JEV: '1', TYPESAFE_API_KEY: '' } });
  const rows = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  return { r, rows, log };
}

test('it logs the findings of the last reply, prints nothing, and exits 0', () => {
  const { r, rows } = run(JSON.stringify({ hook_event_name: 'Stop', session_id: 's1', cwd: '/w', last_assistant_message: 'The fix is in.\n\nThis check is load-bearing now.' }));
  assert.equal(r.status, 0); assert.equal(r.stdout, '', 'a log-only hook must not speak to the session');
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.deepEqual([row.event, row.session, row.cwd, row.source, row.sentences, row.jev], ['Stop', 's1', '/w', 'last_assistant_message', 2, 'off']);
  assert.deepEqual(row.findings.map(f => [f.rule, f.match]), [['phrase', 'load-bearing']]);
  assert.equal(row.findings[0].sentence, 'This check is load-bearing now.');
  assert.match(row.ts, /^\d{4}-\d\d-\d\dT/);
});

test('a clean reply is logged too, because the rate needs the clean ones', () => {
  const { rows } = run(JSON.stringify({ hook_event_name: 'Stop', session_id: 's1', last_assistant_message: 'The test fails on seed r.' }));
  assert.deepEqual([rows.length, rows[0].findings.length, rows[0].sentences], [1, 0, 1]);
});

test('with no message in the input, it reads the last assistant text from the transcript', () => {
  const dir = tmpdir(); const tp = path.join(dir, 't.jsonl');
  fs.writeFileSync(tp, [
    { type: 'assistant', message: { content: [{ type: 'text', text: 'An old reply that is load-bearing.' }] } },
    { type: 'user', message: { content: [{ type: 'text', text: 'go on' }] } },
    { type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'A subagent line at its core.' }] } },
    { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'load-bearing thought' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'We delve into the log.' }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: {} }] } },
  ].map(x => JSON.stringify(x)).join('\n') + '\nnot json\n');
  const { rows } = run(JSON.stringify({ hook_event_name: 'Stop', session_id: 's2', transcript_path: tp }), dir);
  assert.equal(rows[0].source, 'transcript');
  assert.deepEqual(rows[0].findings.map(f => f.match), ['delve']);
});

test('a second stop in the same turn is not logged twice', () => {
  const { rows } = run(JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true, last_assistant_message: 'This is load-bearing.' }));
  assert.equal(rows.length, 0);
});

test('bad input does not fail the session: exit 0, nothing printed, and the fault is logged', () => {
  const { r, rows } = run('this is not json');
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
  assert.match(rows[0].error, /JSON|json/);
});

test('no text anywhere is logged as such', () => {
  const { rows } = run(JSON.stringify({ hook_event_name: 'Stop', session_id: 's3' }));
  assert.deepEqual([rows[0].source, rows[0].sentences], ['none', 0]);
});
