#!/usr/bin/env node
// A Claude Code Stop hook. It lints the reply that just ended and appends one line to a log.
// It is log only: it prints nothing, it never blocks, and it exits 0 whatever happens.
const fs = require('fs'); const path = require('path'); const os = require('os');
const { lint } = require('../lib/lint');
const LOG = process.env.PROSE_LINT_LOG || path.join(os.homedir(), '.claude', 'prose-lint', 'chat.jsonl');

function append(row) { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n'); }

function key() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try { const m = fs.readFileSync(path.join(os.homedir(), '.config', 'prose-lint', 'env'), 'utf8').match(/^TYPESAFE_API_KEY=(.*)$/m); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; } catch { return ''; }
}

// The last main-thread assistant line that holds text. Thinking, tool calls, and subagent lines are skipped.
function fromTranscript(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    let d; try { d = JSON.parse(lines[i]); } catch { continue; }
    if (d.type !== 'assistant' || d.isSidechain || !d.message || !Array.isArray(d.message.content)) continue;
    const text = d.message.content.filter(b => b.type === 'text').map(b => b.text).join('\n\n');
    if (text.trim()) return text;
  }
  return '';
}

(async () => {
  let input;
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { append({ error: 'input is not JSON: ' + e.message }); return; }
  if (input.stop_hook_active) return;
  let text = '', source = 'none';
  if (typeof input.last_assistant_message === 'string' && input.last_assistant_message.trim()) { text = input.last_assistant_message; source = 'last_assistant_message'; }
  else if (input.transcript_path) { try { text = fromTranscript(input.transcript_path); if (text) source = 'transcript'; } catch {} }
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules.json'), 'utf8'));
  const jev = !process.env.PROSE_LINT_NO_JEV;
  const r = await lint(text, { rules, jev, key: jev ? key() : '', cacheFile: path.join(os.homedir(), '.cache', 'prose-lint', 'jev.json') });
  const { sentences } = require('../lib/split');
  append({ event: input.hook_event_name, session: input.session_id, cwd: input.cwd, source, words: text.split(/\s+/).filter(Boolean).length, sentences: sentences(text).length, jev: r.jev, tokens: r.tokens,
    findings: r.findings.map(f => ({ rule: f.rule, kind: f.kind, score: f.score, match: f.match, sentence: f.sentence })) });
})().catch(e => { try { append({ error: String(e && e.message || e) }); } catch {} }).finally(() => { process.exitCode = 0; });
