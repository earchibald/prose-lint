// Text in, prose sentences out. Code fences, table rows, headings, and rules are not prose.
function proseLines(text) {
  const out = []; let fence = false;
  text.split('\n').forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; out.push(null); return; }
    if (fence || /^\s*(\||#|---+\s*$|===+\s*$|>\s*$)/.test(raw) || !raw.trim()) { out.push(null); return; }
    out.push({ line: i + 1, text: raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '\u0001').replace(/^\s*>\s?/, '').trim() });
  });
  return out;
}

// A paragraph is a run of prose lines. A list marker starts a new one.
function paragraphs(text) {
  const paras = []; let cur = null;
  for (const l of proseLines(text)) {
    if (!l) { cur = null; continue; }
    const item = l.text.startsWith('\u0001'); const t = l.text.replace('\u0001', '');
    if (!cur || item) { cur = { line: l.line, parts: [] }; paras.push(cur); }
    cur.parts.push({ line: l.line, text: t });
  }
  return paras;
}

function sentences(text) {
  const out = [];
  for (const p of paragraphs(text)) {
    // Join the lines, and remember where each line starts so a sentence can name its own.
    let joined = ''; const starts = [];
    for (const part of p.parts) { if (joined) joined += ' '; starts.push([joined.length, part.line]); joined += part.text; }
    const masked = joined.replace(/`[^`]*`/g, m => m.replace(/[.?!]/g, '\u0002'));
    let at = 0;
    for (const piece of masked.split(/(?<=[.?!]["')*_]*)\s+(?=["'(*_`]*[A-Z0-9`])/)) {
      const start = masked.indexOf(piece, at); at = start + piece.length;
      const s = joined.slice(start, start + piece.length).trim();
      if (!/[A-Za-z]{2}/.test(s)) continue;
      const line = starts.filter(([o]) => o <= start).pop()[1];
      out.push({ line, text: s });
    }
  }
  return out;
}

// A long sentence dilutes a pattern score, so a judge also gets its clauses. The whole sentence comes first.
function clauses(sentence, longWords = 18) {
  if (sentence.split(/\s+/).length <= longWords) return [sentence];
  const parts = sentence.split(/\s*(?:[;:]|\s[—–-]\s)\s*|,\s+(?=(?:and|but|so|because|which|while)\b)/)
    .map(s => s.trim()).filter(s => s.split(/\s+/).length >= 4);
  return parts.length > 1 ? [sentence, ...parts] : [sentence];
}

// Headings and table rows: a person reads them, but they are not sentences. Only the phrase layer sees them.
function fragments(text) {
  const out = []; let fence = false;
  text.split('\n').forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; return; }
    if (!fence && /^\s*(\||#)/.test(raw) && !/^\s*\|[\s|:-]+\|?\s*$/.test(raw)) out.push({ line: i + 1, text: raw.trim() });
  });
  return out;
}

module.exports = { sentences, clauses, fragments };
