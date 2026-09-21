const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawn } = require('child_process');
const SERVER = path.join(__dirname, '..', 'server', 'mcp.js');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));

// Start the server, send each request as one JSON line, and collect the replies by id.
function talk(requests, env = {}) {
  return new Promise((resolve, reject) => {
    const home = env.PROSE_LINT_HOME || tmpdir();
    const p = spawn(process.execPath, [SERVER], { env: { PATH: process.env.PATH, HOME: home, PROSE_LINT_HOME: home, PROSE_LINT_NO_JEV: '1', ...env } });
    let buf = ''; const replies = {}; const want = requests.filter(r => r.id !== undefined).length;
    const timer = setTimeout(() => { p.kill(); reject(new Error('the server did not answer: ' + buf)); }, 8000);
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) { const m = JSON.parse(line); replies[m.id] = m; } }
      if (Object.keys(replies).length >= want) { clearTimeout(timer); p.kill(); resolve(replies); } });
    for (const r of requests) p.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...r }) + '\n');
  });
}
const init = { id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } };
const call = (id, name, args) => ({ id, method: 'tools/call', params: { name, arguments: args } });
const textOf = reply => reply.result.content[0].text;

test('it answers the handshake and lists its tools', async () => {
  const r = await talk([init, { method: 'notifications/initialized' }, { id: 2, method: 'tools/list' }]);
  assert.equal(r[1].result.serverInfo.name, 'prose-lint'); assert.ok(r[1].result.capabilities.tools);
  assert.deepEqual(r[2].result.tools.map(t => t.name).sort(), ['lint', 'log_summary', 'status', 'try_rule']);
  for (const t of r[2].result.tools) { assert.ok(t.description.length > 20, t.name); assert.equal(t.inputSchema.type, 'object'); }
});

test('lint reads text, and gives the findings with line, rule, code, and fix', async () => {
  const r = await talk([init, call(2, 'lint', { text: 'Fine words.\n\nThis check is load-bearing now.' })]);
  const out = JSON.parse(textOf(r[2]));
  assert.equal(out.judge, 'off'); assert.deepEqual(out.findings.map(f => [f.line, f.rule, f.code]), [[3, 'phrase', 'PH']]);
  assert.match(out.findings[0].fix, /essential/);
});

test('lint reads a file by its path, and says so when the file is not there', async () => {
  const dir = tmpdir(); const f = path.join(dir, 'a.md'); fs.writeFileSync(f, 'We delve into the log.\n');
  const r = await talk([init, call(2, 'lint', { path: f }), call(3, 'lint', { path: path.join(dir, 'none.md') })]);
  assert.equal(JSON.parse(textOf(r[2])).findings[0].match, 'delve');
  assert.equal(r[3].result.isError, true); assert.match(textOf(r[3]), /none\.md/);
});

test('try_rule runs a draft phrase against sentences that should match and sentences that should not', async () => {
  const r = await talk([init, call(2, 'try_rule', { phrase: { re: 'moving forward', alt: 'cut it' }, should_match: ['Moving forward, we test.'], should_not_match: ['The wolf is moving forward slowly.', 'Run the soak.'] })]);
  const out = JSON.parse(textOf(r[2]));
  assert.deepEqual(out.should_match.map(x => x.matched), [true]);
  assert.deepEqual(out.should_not_match.map(x => x.matched), [true, false], 'the draft is too broad, and the tool shows it');
  assert.equal(out.ok, false);
});

test('status says whether a key is there without showing it, and names the folders and the rule counts', async () => {
  const home = tmpdir(); fs.writeFileSync(path.join(home, 'rules.local.json'), JSON.stringify({ phrases: [{ re: 'x y', alt: 'z', example: 'x y' }] }));
  const r = await talk([init, call(2, 'status', {})], { PROSE_LINT_HOME: home, PROSE_LINT_NO_JEV: '', CLAUDE_PLUGIN_OPTION_API_KEY: 'sk-secret-value' });
  const t = textOf(r[2]); const out = JSON.parse(t);
  assert.doesNotMatch(t, /sk-secret-value/); assert.equal(out.key, 'set, from the plugin option');
  assert.equal(out.rules.phrases, 16); assert.equal(out.rules.your_own_file, path.join(home, 'rules.local.json'));
  assert.equal(out.options.message_format, 'short');
});

test('log_summary reads the reply log', async () => {
  const home = tmpdir(); fs.writeFileSync(path.join(home, 'chat.jsonl'), [1, 2].map(i => JSON.stringify({ ts: new Date().toISOString(), session: 'a', sentences: 5, findings: [{ rule: 'phrase', kind: 'hit', sentence: 'It is load-bearing ' + i }] })).join('\n') + '\n');
  const r = await talk([init, call(2, 'log_summary', { log: 'replies' })], { PROSE_LINT_HOME: home });
  const out = JSON.parse(textOf(r[2])); assert.equal(out.replies, 2); assert.equal(out.rules[0].rule, 'phrase');
});

test('an unknown tool or method gets an error reply, and the server stays up', async () => {
  const r = await talk([init, call(2, 'nope', {}), { id: 3, method: 'bogus/method' }, { id: 4, method: 'tools/list' }]);
  assert.equal(r[2].result.isError, true); assert.equal(r[3].error.code, -32601); assert.equal(r[4].result.tools.length, 4);
});
