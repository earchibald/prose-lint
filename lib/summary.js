// Reads the rows of the chat log and gives the numbers a person wants: how often, which rules, which sentences.
function summarise(rows, examples = 5) {
  const real = rows.filter(r => !r.error && r.session !== 'install-check' && r.session !== 'pipe');
  const by = {};
  for (const r of real) for (const f of r.findings || []) (by[f.rule] = by[f.rule] || []).push(f);
  const sentences = real.reduce((n, r) => n + (r.sentences || 0), 0);
  const rules = Object.entries(by).map(([rule, fs]) => ({ rule, count: fs.length, per100: sentences ? Math.round(fs.length / sentences * 1000) / 10 : 0,
    examples: fs.slice().sort((a, b) => (b.score || 1) - (a.score || 1)).slice(0, examples).map(f => f.sentence) })).sort((a, b) => b.count - a.count);
  return { replies: real.length, sentences, repliesWithFindings: real.filter(r => (r.findings || []).length).length, errors: rows.filter(r => r.error).length, rules };
}
module.exports = { summarise };
