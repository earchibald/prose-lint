#!/usr/bin/env node
// A Claude Code PostToolUse hook for Write, Edit, and MultiEdit. It lints the new text of a prose file.
// When it finds a banned phrase, a counted fault, or a pattern the judge confirms, it tells the session that wrote the text.
// It never fails the tool call: it exits 0 whatever happens, and it prints nothing when the text is clean.
const fs = require('fs'); const path = require('path');
const { lint } = require('../lib/lint');
const { HOME_LOGS, CACHE, key, append, rules: loadRules, slim, jevOn } = require('../lib/hookutil');
const LOG = process.env.PROSE_LINT_WRITE_LOG || path.join(HOME_LOGS, 'writes.jsonl');

// The pieces of new text, each with the file line it starts on. An edit is found in the file as it is now.
function pieces(input) {
  const ti = input.tool_input || {}; const file = ti.file_path || '';
  if (input.tool_name === 'Write') return [{ text: ti.content || '', at: 1 }];
  const news = input.tool_name === 'MultiEdit' ? (ti.edits || []).map(e => e.new_string) : [ti.new_string];
  let disk = ''; try { disk = fs.readFileSync(file, 'utf8'); } catch {}
  return news.filter(s => typeof s === 'string' && s.trim()).map(text => { const i = disk.indexOf(text); return { text, at: i < 0 ? 1 : disk.slice(0, i).split('\n').length }; });
}

(async () => {
  let input; try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return; }
  const file = (input.tool_input || {}).file_path || ''; const rules = loadRules(); const h = rules.hook;
  if (!h.proseExtensions.includes(path.extname(file).toLowerCase()) || h.ignore.some(s => file.includes(s))) return;
  const off = Object.entries(h.ruleIgnore).filter(([, paths]) => paths.some(s => file.includes(s))).map(([rule]) => rule);
  const all = []; let jev = 'off', tokens = 0;
  for (const p of pieces(input)) {
    const r = await lint(p.text, { rules, jev: jevOn(), key: key(), cacheFile: CACHE });
    jev = r.jev; tokens += r.tokens;
    for (const f of r.findings) if (!off.includes(f.rule)) all.push({ ...f, line: f.line + p.at - 1 });
  }
  append(LOG, { event: input.hook_event_name, tool: input.tool_name, session: input.session_id, agent: input.agent_id || input.agent_type, cwd: input.cwd, file, jev, tokens, findings: all.map(slim) });
  // A hint is a shape that only the judge can confirm, so it stays in the log and does not go to the session.
  const tell = all.filter(f => f.kind !== 'hint').sort((a, b) => (b.score || 1) - (a.score || 1));
  if (!tell.length) return;
  const shown = tell.slice(0, h.maxFindings).sort((a, b) => a.line - b.line);
  const lines = shown.map(f => `${file}:${f.line}  ${f.kind === 'judge' ? `${f.rule} ${f.score.toFixed(2)}` : f.rule}${f.note ? '  (' + f.note + ')' : ''}\n    ${(f.kind === 'judge' && f.match !== f.sentence ? '… ' + f.match : f.sentence).slice(0, 240)}`);
  const more = tell.length - shown.length;
  const text = `prose-lint read the text you just wrote to ${file} and found ${tell.length} banned pattern${tell.length === 1 ? '' : 's'}.\n`
    + `Rewrite each sentence as a plain fact about a named thing, then continue. Leave a sentence as it is only when it is a quotation or text the user approved word for word.\n\n`
    + lines.join('\n') + (more > 0 ? `\n\nand ${more} more. Run: prose-lint ${file}` : '') + (jev !== 'ran' && jev !== 'off' ? `\n\nThe judge did not run (${jev}), so only phrases and counted rules were checked.` : '');
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
})().catch(() => {}).finally(() => { process.exitCode = 0; });
