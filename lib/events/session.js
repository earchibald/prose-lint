// SessionStart: a short report of what the reply log holds for this project over the last seven days.
// It uses the session's own recent sentences as the example, and it costs a few lines once for each session.
const fs = require('fs');
const DAYS = 7, FEWEST = 5;
module.exports = async function session(input, ctx) {
  if (!ctx.cfg.sessionReport || !input.cwd) return null;
  let rows; try { rows = fs.readFileSync(ctx.files.chat, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return null; }
  const since = new Date(Date.now() - DAYS * 86400e3).toISOString();
  const mine = rows.filter(r => !r.error && r.cwd === input.cwd && (r.ts || '') >= since && !['install-check', 'pipe'].includes(r.session));
  if (mine.length < FEWEST) return null;
  const sentences = mine.reduce((n, r) => n + (r.sentences || 0), 0) || 1; const by = {}; let worst = null;
  for (const r of mine) for (const f of r.findings || []) { if (f.kind === 'hint') continue; by[f.rule] = (by[f.rule] || 0) + 1; if (f.kind === 'judge' && (!worst || f.score > worst.score)) worst = f; }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4); if (!top.length) return null;
  const code = id => (ctx.rules.codes[id] || [(ctx.rules.questions[id] || {}).code])[0] || id;
  const legend = id => (ctx.rules.codes[id] || [0, (ctx.rules.questions[id] || {}).legend])[1] || '';
  let text = `prose-lint, your last ${mine.length} replies in this project: ${top.map(([id, n]) => `${code(id)} ${n}`).join(', ')} (for each 100 sentences: ${top.map(([, n]) => Math.round(n / sentences * 100)).join(', ')}).\n`
    + top.map(([id]) => `${code(id)} ${legend(id)}.`).join(' ');
  if (worst) text += `\nMost marked: "${worst.sentence.slice(0, 110)}" (${code(worst.rule)})`;
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } };
};
