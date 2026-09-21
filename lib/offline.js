// The two layers that need no network: exact phrases, and rules a program can count.
// A "hit" is certain. A "hint" is a shape that only a judge can confirm, and `ask` names the question for it.
const noCode = s => s.replace(/`[^`]*`/g, m => ' '.repeat(m.length));

// A general noun, then "is (not) a/the/bare noun". A named thing ("The soak", "`door.js`") does not open the shape.
const MAXIM = /(?:^|[,;:]\s+|\b(?:because|that|and|but|so)\s+)(?:an?|every|any|no)\s+[a-z][a-z' -]{1,60}?\s+(?:is|are)\s+(?:not\s+)?(?:an?\s+|the\s+)?[a-z]+/i;
const TRIPLET = /\b[a-z]+(?: [a-z]+)?, [a-z]+(?: [a-z]+)?,? (?:and|or) [a-z]+\b/i;

function offline(sentence, rules) {
  const out = []; const s = noCode(sentence);
  for (const p of rules.phrases) {
    const m = s.match(new RegExp('(?<![A-Za-z])(?:' + p.re + ')(?![A-Za-z])', 'i'));
    if (m) out.push({ rule: 'phrase', kind: 'hit', match: m[0].toLowerCase(), note: 'use: ' + p.alt });
  }
  if (/[—]|\s–\s/.test(s)) out.push({ rule: 'em-dash', kind: 'hit', match: '—', note: 'use a full stop or a comma' });
  const n = s.trim().split(/\s+/).length;
  if (n > rules.limits.sentenceWords) out.push({ rule: 'long-sentence', kind: 'hit', match: '', note: `${n} words, the limit is ${rules.limits.sentenceWords}` });
  const verb = s.match(new RegExp('\\b(?:' + rules.agentVerbs.join('|') + ')\\b', 'i'));
  if (verb) out.push({ rule: 'thing-acts', kind: 'hint', ask: 'thing_acts', match: verb[0].toLowerCase(), note: 'if the subject is a thing, say what it is or has' });
  const mx = s.match(MAXIM);
  if (mx) out.push({ rule: 'x-is-a-y', kind: 'hint', ask: 'x_is_a_y', match: mx[0].trim(), note: 'if this is a maxim and not a definition, state the fact about the named thing' });
  const tr = s.match(TRIPLET);
  if (tr) out.push({ rule: 'triplet', kind: 'hint', match: tr[0], note: 'if the three items say one thing, keep one' });
  return out;
}
module.exports = { offline };
