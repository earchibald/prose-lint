// Turns findings into the message that a session reads. The short form is the default: the subject once, then one
// line for each finding with its line, a two-letter code, and a few words. It explains only the codes it used,
// because a helper agent does not get the style file that would teach them.
const path = require('path');
const codeOf = (rules, id) => (rules.codes[id] || [(rules.questions[id] || {}).code, (rules.questions[id] || {}).legend]);
const clip = (s, n) => s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;

function formatFindings(findings, { rules, format, subject, kind, jev }) {
  const max = rules.hook.maxFindings, n = findings.length;
  const shown = findings.slice().sort((a, b) => (b.score || 1) - (a.score || 1)).slice(0, max).sort((a, b) => a.line - b.line);
  const judgeNote = jev && jev !== 'ran' && jev !== 'off' ? `\nThe judge did not run (${jev}). Only phrases and counted rules were checked.` : '';
  if (format === 'long') {
    const where = f => kind === 'file' ? `${subject}:${f.line}` : `line ${f.line}`;
    const lines = shown.map(f => `${where(f)}  ${f.kind === 'judge' ? `${f.rule} ${f.score.toFixed(2)}` : f.rule}${f.note ? '  (' + f.note + ')' : ''}\n    ${(f.kind === 'judge' && f.match !== f.sentence ? '… ' + f.match : f.sentence).slice(0, 240)}`);
    const head = kind === 'file'
      ? `prose-lint read the text you just wrote to ${subject} and found ${n} banned pattern${n === 1 ? '' : 's'}.\nRewrite each sentence as a plain fact about a named thing, then continue. Leave a sentence as it is only when it is a quotation or text the user approved word for word.`
      : `prose-lint read this ${subject} and found ${n} banned pattern${n === 1 ? '' : 's'}. The command did not run.\nRewrite each sentence as a plain fact about a named thing, and run the command with the new text.\nIf a flagged sentence is a quotation, or text the user approved word for word, run the same command again with the same text, and it will pass.`;
    return head + '\n\n' + lines.join('\n') + (n > max ? `\n\nand ${n - max} more.${kind === 'file' ? ' Run: prose-lint ' + subject : ''}` : '') + judgeNote;
  }
  const used = new Map();
  const lines = shown.map(f => { const [code, legend] = codeOf(rules, f.rule); used.set(code, legend); return `L${f.line} ${code} "${clip(f.kind === 'judge' ? f.match : (f.match && f.rule === 'phrase' ? f.match : f.sentence), 60)}"`; });
  const head = kind === 'file' ? `prose-lint ${path.basename(subject)}: ${n} to fix` : `prose-lint: the ${subject} has ${n} to fix, so the command did not run. Send the same text again only for a quotation.`;
  return head + '\n' + lines.join('\n') + (n > max ? `\n+${n - max} more` : '') + '\n' + [...used].map(([c, l]) => `${c} ${l}.`).join(' ') + judgeNote;
}
module.exports = { formatFindings };
