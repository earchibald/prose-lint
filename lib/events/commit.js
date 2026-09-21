// PreToolUse for Bash: read the prose that a command writes for other people, and deny the command once if it has findings.
// The same text a second time is passed and logged as kept, because a quotation or approved text must be able to stay.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { messageOf } = require('../message'); const { append, slim } = require('./common'); const { formatFindings } = require('../format');
const KEEP_MS = 30 * 60 * 1000; const NAMES = { commit: 'commit message', pr: 'pull request', issue: 'issue', comment: 'comment' };

module.exports = async function commit(input, ctx) {
  const command = (input.tool_input || {}).command;
  if (ctx.cfg.commitCheck === 'off' || input.tool_name !== 'Bash' || typeof command !== 'string' || !/\b(git|gh)\b/.test(command)) return null;
  const msg = messageOf(command, input.cwd); if (!msg) return null;
  const r = await ctx.check(msg.text); const tell = r.findings.filter(f => f.kind !== 'hint');
  const row = { event: input.hook_event_name, session: input.session_id, agent: input.agent_id, cwd: input.cwd, kind: msg.kind, words: msg.text.split(/\s+/).length, jev: r.jev, tokens: r.tokens, findings: r.findings.map(slim) };
  if (!tell.length) { append(ctx.files.commits, { ...row, decision: 'allow' }); return null; }
  const hash = crypto.createHash('sha256').update(msg.kind + '\u0000' + msg.text).digest('hex').slice(0, 20);
  let acks = {}; try { acks = JSON.parse(fs.readFileSync(ctx.files.acks, 'utf8')); } catch {}
  const now = Date.now(); for (const k of Object.keys(acks)) if (now - acks[k] > KEEP_MS) delete acks[k];
  if (acks[hash]) { append(ctx.files.commits, { ...row, decision: 'kept' }); return null; }
  acks[hash] = now; fs.mkdirSync(path.dirname(ctx.files.acks), { recursive: true }); fs.writeFileSync(ctx.files.acks, JSON.stringify(acks));
  append(ctx.files.commits, { ...row, decision: 'deny' });
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: formatFindings(tell, { rules: ctx.rules, format: ctx.cfg.format, subject: NAMES[msg.kind], kind: 'commit', jev: r.jev }) } };
};
