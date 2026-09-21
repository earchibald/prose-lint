#!/usr/bin/env node
// A Claude Code PreToolUse hook for Bash. It reads the prose that a command writes for other people: a commit
// message, or the text of a pull request, an issue, or a comment. If the text has a banned phrase, a counted
// fault, or a pattern the judge confirms, the hook denies the command once and gives the findings.
// The same text a second time is passed, because a quotation or approved text must be able to stay.
// The hook never blocks a command by accident: on any fault of its own it exits 0 and prints nothing.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { lint } = require('../lib/lint');
const { messageOf } = require('../lib/message');
const { HOME_LOGS, CACHE, key, append, rules: loadRules, slim, jevOn } = require('../lib/hookutil');
const LOG = process.env.PROSE_LINT_COMMIT_LOG || path.join(HOME_LOGS, 'commits.jsonl');
const STATE = process.env.PROSE_LINT_STATE || path.join(HOME_LOGS, 'acks.json');
const KEEP_MS = 30 * 60 * 1000;
const NAMES = { commit: 'commit message', pr: 'pull request', issue: 'issue', comment: 'comment' };

(async () => {
  let input; try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return; }
  const command = (input.tool_input || {}).command;
  if (typeof command !== 'string' || !/\b(git|gh)\b/.test(command)) return;
  const msg = messageOf(command, input.cwd); if (!msg) return;
  const rules = loadRules();
  const r = await lint(msg.text, { rules, jev: jevOn(), key: key(), cacheFile: CACHE });
  // A hint is a shape that only the judge can confirm, so it never denies a command.
  const tell = r.findings.filter(f => f.kind !== 'hint').sort((a, b) => a.line - b.line);
  const row = { event: input.hook_event_name, session: input.session_id, agent: input.agent_id, cwd: input.cwd, kind: msg.kind, words: msg.text.split(/\s+/).length, jev: r.jev, tokens: r.tokens, findings: r.findings.map(slim) };
  if (!tell.length) { append(LOG, { ...row, decision: 'allow' }); return; }
  const hash = crypto.createHash('sha256').update(msg.kind + '\u0000' + msg.text).digest('hex').slice(0, 20);
  let acks = {}; try { acks = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
  const now = Date.now(); for (const k of Object.keys(acks)) if (now - acks[k] > KEEP_MS) delete acks[k];
  if (acks[hash]) { append(LOG, { ...row, decision: 'kept' }); return; }
  acks[hash] = now; fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(acks));
  append(LOG, { ...row, decision: 'deny' });
  const max = rules.hook.maxFindings; const shown = tell.slice(0, max);
  const lines = shown.map(f => `line ${f.line}  ${f.kind === 'judge' ? `${f.rule} ${f.score.toFixed(2)}` : f.rule}${f.note ? '  (' + f.note + ')' : ''}\n    ${(f.kind === 'judge' && f.match !== f.sentence ? '… ' + f.match : f.sentence).slice(0, 240)}`);
  const reason = `prose-lint read this ${NAMES[msg.kind]} and found ${tell.length} banned pattern${tell.length === 1 ? '' : 's'}. The command did not run.\n`
    + `Rewrite each sentence as a plain fact about a named thing, and run the command with the new text.\n`
    + `If a flagged sentence is a quotation, or text the user approved word for word, run the same command again with the same text, and it will pass.\n\n`
    + lines.join('\n') + (tell.length > max ? `\n\nand ${tell.length - max} more.` : '') + (r.jev !== 'ran' && r.jev !== 'off' ? `\n\nThe judge did not run (${r.jev}), so only phrases and counted rules were checked.` : '');
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
})().catch(() => {}).finally(() => { process.exitCode = 0; });
