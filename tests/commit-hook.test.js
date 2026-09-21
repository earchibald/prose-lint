const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');
const HOOK = path.join(__dirname, '..', 'hooks', 'commit-check.js');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));
// Offline, with the log and the state moved, so a test never touches the service or the user's files.
function run(command, dir) {
  const env = { ...process.env, PROSE_LINT_COMMIT_LOG: path.join(dir, 'commits.jsonl'), PROSE_LINT_STATE: path.join(dir, 'acks.json'), PROSE_LINT_NO_JEV: '1', TYPESAFE_API_KEY: '', CLAUDE_PLUGIN_OPTION_MESSAGE_FORMAT: 'long' };
  const input = typeof command === 'string' && command.startsWith('{') ? command : JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', session_id: 's', cwd: dir, tool_input: { command } });
  const r = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8', env });
  const log = env.PROSE_LINT_COMMIT_LOG; const rows = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  return { r, rows, out: r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null };
}

test('a command with no message is passed without a word and without a log line', () => {
  const dir = tmpdir(); const { r, rows } = run('ls -la', dir);
  assert.equal(r.status, 0); assert.equal(r.stdout, ''); assert.equal(rows.length, 0);
});

test('a clean commit message is passed, and logged', () => {
  const dir = tmpdir(); const { r, rows } = run('git commit -m "Clear the wolf cache at dawn"', dir);
  assert.equal(r.stdout, ''); assert.deepEqual([rows[0].kind, rows[0].decision, rows[0].findings.length], ['commit', 'allow', 0]);
});

test('a message with a banned phrase is denied once, with the sentence and the fix', () => {
  const dir = tmpdir(); const { out, rows } = run('git commit -m "Keep the list" -m "The list is load-bearing for task 3."', dir);
  assert.equal(out.hookEventName, 'PreToolUse'); assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /The list is load-bearing for task 3\./);
  assert.match(out.permissionDecisionReason, /essential|required/);
  assert.match(out.permissionDecisionReason, /same command again/, 'it says how to go on when the text must stay');
  assert.equal(rows[0].decision, 'deny');
});

test('the same message a second time is passed, and logged as kept', () => {
  const dir = tmpdir(); const cmd = 'git commit -m "The list is load-bearing for task 3."';
  assert.equal(run(cmd, dir).out.permissionDecision, 'deny');
  const second = run(cmd, dir);
  assert.equal(second.r.stdout, ''); assert.equal(second.rows[1].decision, 'kept');
});

test('a changed message that still has a fault is denied again', () => {
  const dir = tmpdir();
  run('git commit -m "The list is load-bearing for task 3."', dir);
  assert.equal(run('git commit -m "The list is load-bearing for task 4."', dir).out.permissionDecision, 'deny');
});

test('a hint does not deny a commit', () => {
  const dir = tmpdir(); const { r, rows } = run('git commit -m "The default soak carries the oracle"', dir);
  assert.equal(r.stdout, ''); assert.equal(rows[0].decision, 'allow');
});

test('a pull request body is checked too', () => {
  const dir = tmpdir(); const { out } = run('gh pr create --title "Add the gate" --body "We delve into every string."', dir);
  assert.equal(out.permissionDecision, 'deny'); assert.match(out.permissionDecisionReason, /pull request/);
});

test('bad input never blocks a command: exit 0 and nothing printed', () => {
  const dir = tmpdir(); const r = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8', env: { ...process.env, PROSE_LINT_COMMIT_LOG: path.join(dir, 'c'), PROSE_LINT_STATE: path.join(dir, 'a') } });
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
});
