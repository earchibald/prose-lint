// What the two hooks share: the key, the log, and the rule file.
const fs = require('fs'); const path = require('path'); const os = require('os');
const HOME_LOGS = path.join(os.homedir(), '.claude', 'prose-lint');
const CACHE = path.join(os.homedir(), '.cache', 'prose-lint', 'jev.json');
function key() {
  if (process.env.PROSE_LINT_NO_JEV) return '';
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try { const m = fs.readFileSync(path.join(os.homedir(), '.config', 'prose-lint', 'env'), 'utf8').match(/^TYPESAFE_API_KEY=(.*)$/m); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; } catch { return ''; }
}
function append(file, row) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n'); }
const rules = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules.json'), 'utf8'));
const slim = f => ({ rule: f.rule, kind: f.kind, score: f.score, line: f.line, match: f.match, sentence: f.sentence });
module.exports = { HOME_LOGS, CACHE, key, append, rules, slim, jevOn: () => !process.env.PROSE_LINT_NO_JEV };
