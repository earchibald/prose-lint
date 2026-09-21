// The rules that ship with the plugin, with your own rules file on top.
// An update replaces the plugin folder, so your rules are kept outside it, in <home>/rules.local.json.
const fs = require('fs'); const path = require('path');
const BASE = path.join(__dirname, '..', 'rules.json');

function loadRules({ home }) {
  const r = JSON.parse(fs.readFileSync(BASE, 'utf8')); const file = path.join(home, 'rules.local.json');
  let own; try { own = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') r.localError = `${file} could not be read: ${e.message}`; return r; }
  const gone = new Set(own.removePhrases || []);
  r.phrases = r.phrases.filter(p => !gone.has(p.re)).concat(own.phrases || []);
  for (const [id, q] of Object.entries(own.questions || {})) r.questions[id] = { ...(r.questions[id] || {}), ...q };
  for (const id of own.disableQuestions || []) delete r.questions[id];
  r.agentVerbs = r.agentVerbs.concat(own.agentVerbs || []);
  r.limits = { ...r.limits, ...(own.limits || {}) };
  const h = own.hook || {};
  r.hook = { ...r.hook, ...h, ignore: r.hook.ignore.concat(h.ignore || []), proseExtensions: r.hook.proseExtensions.concat(h.proseExtensions || []), ruleIgnore: { ...r.hook.ruleIgnore, ...(h.ruleIgnore || {}) } };
  return r;
}
module.exports = { loadRules, BASE };
