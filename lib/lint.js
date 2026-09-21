// Joins the layers. The offline layers always run. The judge runs when asked, and its answer replaces a hint.
const { sentences, clauses, fragments } = require('./split');
const { offline } = require('./offline');
const { judge } = require('./jev');

async function lint(text, { rules, jev = false, key, fetch: fetch_, cacheFile, min }) {
  const sents = sentences(text); const findings = [];
  const per = sents.map(s => ({ s, off: offline(s.text, rules), parts: clauses(s.text, rules.limits.clauseWords) }));
  let state = 'off', tokens = 0, scores = null;
  if (jev) {
    const r = await judge(per.flatMap(p => p.parts), rules.questions, { fetch: fetch_, key, cacheFile });
    tokens = r.tokens; state = r.skipped || 'ran'; if (!r.skipped) scores = r.scores;
  }
  for (const fr of fragments(text)) for (const f of offline(fr.text, rules)) if (f.rule === 'phrase') findings.push({ line: fr.line, sentence: fr.text, ...f });
  for (const p of per) {
    for (const f of p.off) if (!(scores && f.ask)) findings.push({ line: p.s.line, sentence: p.s.text, ...f });
    if (!scores) continue;
    for (const [id, q] of Object.entries(rules.questions)) {
      // A question marked `clauses` takes its best clause, and on a tie the narrowest one. The others read the whole sentence only.
      const parts = q.clauses ? p.parts : [p.parts[0]];
      let best = parts[0], score = -1;
      for (const part of parts) { const v = (scores[part] || {})[id]; if (v !== undefined && (v > score || (v === score && part.length < best.length))) { score = v; best = part; } }
      if (score >= (min !== undefined ? min : q.min)) findings.push({ line: p.s.line, sentence: p.s.text, rule: id, kind: 'judge', score: Math.round(score * 100) / 100, match: best, note: '' });
    }
  }
  findings.sort((a, b) => a.line - b.line);
  return { jev: state, tokens, findings };
}
module.exports = { lint };
