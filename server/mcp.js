#!/usr/bin/env node
// The plugin's own server. A skill cannot reach the judge through a shell command, because Claude Code gives the
// secret key only to the plugin's hooks and to this process. So a skill calls these tools instead.
// The protocol is MCP over stdin and stdout: one JSON-RPC message on each line. There are no packages to install.
const fs = require('fs'); const path = require('path'); const readline = require('readline');
const { context } = require('../lib/events/common'); const { judge } = require('../lib/jev'); const { summarise } = require('../lib/summary');
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
const codeOf = (rules, id) => (rules.codes[id] || [(rules.questions[id] || {}).code])[0];

const TOOLS = [
  { name: 'lint', description: 'Check prose for banned phrases, counted faults, and the patterns that the judge model confirms. Give `text`, or give `path` to a file. Returns each finding with its line, rule, code, score, sentence, and fix.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The prose to check.' }, path: { type: 'string', description: 'Absolute path of a file to check.' }, judge: { type: 'boolean', description: 'false checks phrases and counted rules only. Default true.' } } } },
  { name: 'try_rule', description: 'Test a draft rule before you save it. Give a draft `phrase` ({re, alt}) or a draft `question` ({instructions, criteria: {true, false}, min}), with sentences that should match and sentences that should not. Returns what matched, each score, and `ok`.',
    inputSchema: { type: 'object', properties: { phrase: { type: 'object' }, question: { type: 'object' }, should_match: { type: 'array', items: { type: 'string' } }, should_not_match: { type: 'array', items: { type: 'string' } } }, required: ['should_match', 'should_not_match'] } },
  { name: 'status', description: 'Report the state of the plugin: whether a key for the judge is set (never the key itself), the options, the folders, the rule counts, your own rules file, and when each hook last wrote to its log.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'log_summary', description: 'Summarise one of the three logs. `log` is "replies", "writes", or "commits". `since` is an optional date such as 2026-09-20. Returns counts for each rule, a rate for each 100 sentences, and example sentences.',
    inputSchema: { type: 'object', properties: { log: { type: 'string', enum: ['replies', 'writes', 'commits'] }, since: { type: 'string' } }, required: ['log'] } },
];

const rowsOf = file => { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return { error: 'bad line' }; } }); } catch { return []; } };

const RUN = {
  async lint(a) {
    const ctx = context(); let text = a.text;
    if (typeof a.path === 'string') { try { text = fs.readFileSync(a.path, 'utf8'); } catch (e) { throw new Error(`${a.path} could not be read: ${e.code || e.message}`); } }
    if (typeof text !== 'string') throw new Error('give `text` or `path`');
    const { lint } = require('../lib/lint');
    const r = await lint(text, { rules: ctx.rules, jev: ctx.cfg.jev && a.judge !== false, key: ctx.cfg.key, cacheFile: ctx.cfg.cache });
    return { judge: r.jev, tokens: r.tokens, findings: r.findings.map(f => ({ line: f.line, rule: f.rule, code: codeOf(ctx.rules, f.rule), kind: f.kind, score: f.score, match: f.match, sentence: f.sentence, fix: f.note })) };
  },
  async try_rule(a) {
    const ctx = context(); const yes = a.should_match || [], no = a.should_not_match || [];
    if (a.phrase) {
      const re = new RegExp('(?<![A-Za-z])(?:' + a.phrase.re + ')(?![A-Za-z])', 'i'); const t = s => ({ sentence: s, matched: re.test(s.replace(/`[^`]*`/g, ' ')) });
      const out = { kind: 'phrase', should_match: yes.map(t), should_not_match: no.map(t) };
      return { ...out, ok: out.should_match.every(x => x.matched) && out.should_not_match.every(x => !x.matched) };
    }
    if (!a.question) throw new Error('give a draft `phrase` or a draft `question`');
    if (!ctx.cfg.key) throw new Error('a draft question needs the judge, and no key is set. Set it in the plugin options.');
    const min = a.question.min || 0.8; const q = { draft: { type: 'noul', version: Date.now(), instructions: a.question.instructions, criteria: a.question.criteria } };
    const r = await judge([...yes, ...no], q, { key: ctx.cfg.key, cacheFile: path.join(ctx.cfg.home, 'drafts-cache.json') });
    if (r.skipped) throw new Error('the judge did not run: ' + r.skipped);
    const t = s => ({ sentence: s, score: Math.round(r.scores[s].draft * 100) / 100, matched: r.scores[s].draft >= min });
    const out = { kind: 'question', min, should_match: yes.map(t), should_not_match: no.map(t) };
    return { ...out, ok: out.should_match.every(x => x.matched) && out.should_not_match.every(x => !x.matched) };
  },
  async status() {
    const ctx = context(); const e = process.env; const last = f => { const r = rowsOf(f); return r.length ? r[r.length - 1].ts : 'never'; };
    const own = path.join(ctx.cfg.home, 'rules.local.json');
    return { version: VERSION,
      key: !ctx.cfg.key ? 'not set: the judge will not run' : e.CLAUDE_PLUGIN_OPTION_API_KEY ? 'set, from the plugin option' : e.TYPESAFE_API_KEY ? 'set, from TYPESAFE_API_KEY' : 'set, from ~/.config/prose-lint/env',
      options: { message_format: ctx.cfg.format, write_feedback: ctx.cfg.writeFeedback, commit_check: ctx.cfg.commitCheck, reply_log: ctx.cfg.replyLog, session_report: ctx.cfg.sessionReport },
      folders: { logs_and_your_rules: ctx.cfg.home, saved_judge_answers: ctx.cfg.cache, plugin: path.join(__dirname, '..') },
      rules: { phrases: ctx.rules.phrases.length, questions: Object.keys(ctx.rules.questions), sentence_words: ctx.rules.limits.sentenceWords, ignore: ctx.rules.hook.ignore, your_own_file: own, your_own_file_exists: fs.existsSync(own), your_own_file_error: ctx.rules.localError || null },
      last_log_line: { replies: last(ctx.files.chat), writes: last(ctx.files.writes), commits: last(ctx.files.commits) } };
  },
  async log_summary(a) {
    const ctx = context(); const file = { replies: ctx.files.chat, writes: ctx.files.writes, commits: ctx.files.commits }[a.log]; if (!file) throw new Error('`log` must be replies, writes, or commits');
    const rows = rowsOf(file).filter(r => !a.since || (r.ts || '') >= a.since); const s = summarise(rows);
    const decisions = {}; for (const r of rows) if (r.decision) decisions[r.decision] = (decisions[r.decision] || 0) + 1;
    return { log: a.log, since: a.since || 'the start', ...s, ...(a.log === 'commits' ? { decisions } : {}) };
  },
};

const send = m => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
readline.createInterface({ input: process.stdin }).on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return; // a notification needs no reply
  try {
    if (m.method === 'initialize') return send({ id: m.id, result: { protocolVersion: (m.params || {}).protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'prose-lint', version: VERSION } } });
    if (m.method === 'ping') return send({ id: m.id, result: {} });
    if (m.method === 'tools/list') return send({ id: m.id, result: { tools: TOOLS } });
    if (m.method === 'tools/call') {
      const fn = RUN[(m.params || {}).name];
      try { if (!fn) throw new Error('no such tool: ' + (m.params || {}).name); return send({ id: m.id, result: { content: [{ type: 'text', text: JSON.stringify(await fn(m.params.arguments || {}), null, 1) }] } }); }
      catch (e) { return send({ id: m.id, result: { isError: true, content: [{ type: 'text', text: String(e.message || e) }] } }); }
    }
    send({ id: m.id, error: { code: -32601, message: 'method not found: ' + m.method } });
  } catch (e) { send({ id: m.id, error: { code: -32603, message: String(e.message || e) } }); }
});
