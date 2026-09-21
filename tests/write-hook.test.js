const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');
const HOOK = path.join(__dirname, '..', 'hooks', 'write-feedback.js');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));
// Offline, with the log moved, so a test never touches the service or the user's own log.
function run(input, dir = tmpdir()) {
  const log = path.join(dir, 'writes.jsonl');
  const r = spawnSync(process.execPath, [HOOK], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', env: { ...process.env, PROSE_LINT_WRITE_LOG: log, PROSE_LINT_NO_JEV: '1', TYPESAFE_API_KEY: '' } });
  const rows = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  const ctx = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
  return { r, rows, ctx };
}
const write = (file_path, content) => ({ hook_event_name: 'PostToolUse', tool_name: 'Write', session_id: 's', tool_input: { file_path, content } });

test('a written Markdown file with a banned phrase gives the session the file, the line, the rule, and the sentence', () => {
  const { r, ctx, rows } = run(write('/w/report.md', 'Fine words are here.\n\nThis check is load-bearing now.\n'));
  assert.equal(r.status, 0);
  assert.equal(ctx.hookEventName, 'PostToolUse');
  assert.match(ctx.additionalContext, /\/w\/report\.md:3/);
  assert.match(ctx.additionalContext, /phrase/);
  assert.match(ctx.additionalContext, /This check is load-bearing now\./);
  assert.match(ctx.additionalContext, /essential|required/, 'the plain alternative is given');
  assert.deepEqual([rows[0].file, rows[0].tool, rows[0].findings.length], ['/w/report.md', 'Write', 1]);
});

test('clean text prints nothing, and is still logged', () => {
  const { r, rows } = run(write('/w/report.md', 'Run the soak after every change.'));
  assert.equal(r.stdout, ''); assert.equal(rows[0].findings.length, 0);
});

test('an edit reports the line in the file, not the line in the new text', () => {
  const dir = tmpdir(); const f = path.join(dir, 'notes.md');
  fs.writeFileSync(f, Array.from({ length: 40 }, (_, i) => `Plain line number ${i + 1} is here.`).join('\n\n') + '\n\nWe delve into the log.\n');
  const { ctx } = run({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: f, old_string: 'x', new_string: 'We delve into the log.' } }, dir);
  assert.match(ctx.additionalContext, new RegExp(f.replace(/[.\\/]/g, '\\$&') + ':81\\b'));
});

test('every new string of a MultiEdit is read', () => {
  const { ctx } = run({ hook_event_name: 'PostToolUse', tool_name: 'MultiEdit', tool_input: { file_path: '/w/a.md', edits: [{ old_string: 'a', new_string: 'This is a tapestry of systems.' }, { old_string: 'b', new_string: 'At its core it is a loop.' }] } });
  assert.match(ctx.additionalContext, /tapestry/); assert.match(ctx.additionalContext, /at its core/i);
});

test('a file that is not prose is left alone', () => {
  const { r, rows } = run(write('/w/src/sim/core.js', 'const s = "This is load-bearing.";'));
  assert.equal(r.stdout, ''); assert.equal(rows.length, 0);
});

test('an ignored path is left alone: approved text is used exactly as written', () => {
  const { r, rows } = run(write('/Users/x/Code/hamlet/design/approved-text.md', 'This is load-bearing.'));
  assert.equal(r.stdout, ''); assert.equal(rows.length, 0);
});

test('the memory index keeps its em dash, and a phrase in it is still reported', () => {
  const { ctx } = run(write('/Users/x/.claude/projects/p/memory/MEMORY.md', '- [Title here](a.md) — a plain hook for it\n- [Other title](b.md) — this one is load-bearing\n'));
  assert.doesNotMatch(ctx.additionalContext, /em-dash/);
  assert.match(ctx.additionalContext, /load-bearing/);
});

test('a hint is not sent to the session, because only a judge can confirm it', () => {
  const { r, rows } = run(write('/w/a.md', 'The default soak carries the oracle.'));
  assert.equal(r.stdout, '');
  assert.deepEqual(rows[0].findings.map(f => f.kind), ['hint'], 'the log keeps it');
});

test('many findings are cut to the first twelve, and the rest are counted', () => {
  const { ctx } = run(write('/w/a.md', Array.from({ length: 30 }, (_, i) => `Sentence ${i} is load-bearing.`).join('\n\n')));
  assert.equal((ctx.additionalContext.match(/\/w\/a\.md:\d+/g) || []).length, 12);
  assert.match(ctx.additionalContext, /18 more/);
  assert.ok(ctx.additionalContext.length < 6000);
});

test('bad input does not fail the tool call: exit 0 and nothing printed', () => {
  const { r } = run('not json');
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
});
