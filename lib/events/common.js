// What every event handler shares: the options, the rules, the log files, and the lint call.
const fs = require('fs'); const path = require('path');
const { config } = require('../config'); const { loadRules } = require('../rules'); const { lint } = require('../lint');

function context(env = process.env) {
  const cfg = config(env); const rules = loadRules({ home: cfg.home });
  const files = { chat: env.PROSE_LINT_LOG || path.join(cfg.home, 'chat.jsonl'), writes: env.PROSE_LINT_WRITE_LOG || path.join(cfg.home, 'writes.jsonl'),
    commits: env.PROSE_LINT_COMMIT_LOG || path.join(cfg.home, 'commits.jsonl'), acks: env.PROSE_LINT_STATE || path.join(cfg.home, 'acks.json') };
  return { cfg, rules, files, check: text => lint(text, { rules, jev: cfg.jev, key: cfg.key, cacheFile: cfg.cache }) };
}
function append(file, row) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n'); }
const slim = f => ({ rule: f.rule, kind: f.kind, score: f.score, line: f.line, match: f.match, sentence: f.sentence });
module.exports = { context, append, slim };
