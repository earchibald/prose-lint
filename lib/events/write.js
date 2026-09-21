// PostToolUse for Write, Edit, and MultiEdit: lint the new text of a prose file and send the findings to the session.
const fs = require('fs'); const path = require('path'); const { append, slim } = require('./common'); const { formatFindings } = require('../format');

// The pieces of new text, each with the file line it starts on. An edit is found in the file as it is now.
function pieces(input) {
  const ti = input.tool_input || {}; const file = ti.file_path || '';
  if (input.tool_name === 'Write') return [{ text: ti.content || '', at: 1 }];
  const news = input.tool_name === 'MultiEdit' ? (ti.edits || []).map(e => e.new_string) : [ti.new_string];
  let disk = ''; try { disk = fs.readFileSync(file, 'utf8'); } catch {}
  return news.filter(s => typeof s === 'string' && s.trim()).map(text => { const i = disk.indexOf(text); return { text, at: i < 0 ? 1 : disk.slice(0, i).split('\n').length }; });
}
module.exports = async function write(input, ctx) {
  if (!ctx.cfg.writeFeedback || !['Write', 'Edit', 'MultiEdit'].includes(input.tool_name)) return null;
  const file = (input.tool_input || {}).file_path || ''; const h = ctx.rules.hook;
  if (!h.proseExtensions.includes(path.extname(file).toLowerCase()) || h.ignore.some(s => file.includes(s))) return null;
  const off = Object.entries(h.ruleIgnore).filter(([, paths]) => paths.some(s => file.includes(s))).map(([rule]) => rule);
  const all = []; let jev = 'off', tokens = 0;
  for (const p of pieces(input)) { const r = await ctx.check(p.text); jev = r.jev; tokens += r.tokens; for (const f of r.findings) if (!off.includes(f.rule)) all.push({ ...f, line: f.line + p.at - 1 }); }
  append(ctx.files.writes, { event: input.hook_event_name, tool: input.tool_name, session: input.session_id, agent: input.agent_id || input.agent_type, cwd: input.cwd, file, jev, tokens, findings: all.map(slim) });
  // A hint is a shape that only the judge can confirm, so it stays in the log and does not go to the session.
  const tell = all.filter(f => f.kind !== 'hint'); if (!tell.length) return null;
  return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: formatFindings(tell, { rules: ctx.rules, format: ctx.cfg.format, subject: file, kind: 'file', jev }) } };
};
