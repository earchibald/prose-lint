// Finds the prose that a shell command writes for other people: a commit message, or the title and body of
// a pull request, an issue, or a comment. It returns null for any other command.
const fs = require('fs'); const path = require('path');

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?)\n?^\s*\2\s*$/m;
const ATTRIBUTION = /^(Co-Authored-By:.*|.*Generated with \[Claude Code\].*|Claude-Session:.*)$/gmi;

// Shell words, with quotes read. An unquoted && || ; | or newline ends a simple command.
function commands(src) {
  const all = [[]]; let word = null, i = 0;
  const end = () => { if (word !== null) { all[all.length - 1].push(word); word = null; } };
  while (i < src.length) {
    const c = src[i];
    if (c === "'") { const j = src.indexOf("'", i + 1); word = (word || '') + src.slice(i + 1, j < 0 ? src.length : j); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '"') {
      let s = ''; i++;
      while (i < src.length && src[i] !== '"') { if (src[i] === '\\' && '"\\$`'.includes(src[i + 1])) { s += src[i + 1]; i += 2; } else s += src[i++]; }
      i++; word = (word || '') + s; continue;
    }
    if (c === '\\' && i + 1 < src.length) { word = (word || '') + src[i + 1]; i += 2; continue; }
    if (c === '\n' || c === ';' || c === '|' || (c === '&' && src[i + 1] === '&')) { end(); all.push([]); i += (src[i + 1] === c && c !== '\n' && c !== ';') ? 2 : 1; continue; }
    if (/\s/.test(c)) { end(); i++; continue; }
    word = (word || '') + c; i++;
  }
  end(); return all.filter(w => w.length);
}

const tidy = s => s.replace(ATTRIBUTION, '').replace(/\n{3,}/g, '\n\n').trim();
function readFile(file, cwd) { try { return fs.readFileSync(path.resolve(cwd || '.', file), 'utf8'); } catch { return null; } }

function messageOf(command, cwd) {
  const h = command.match(HEREDOC); const heredoc = h ? h[3] : null;
  const flat = h ? command.replace(HEREDOC, '') : command;
  // A value that was only `$(cat <<EOF ...)` is the heredoc itself.
  const value = v => (heredoc !== null && /^\$\(\s*cat\s*\)?\s*\)?$/.test(v.trim())) ? heredoc : v;
  for (const w of commands(flat)) {
    let k = 0;
    if (w[0] === 'git') {
      k = 1; while (k < w.length && w[k].startsWith('-')) k += (w[k] === '-C' || w[k] === '-c') ? 2 : 1;
      if (w[k] !== 'commit') continue;
      const parts = []; let file = null;
      for (let j = k + 1; j < w.length; j++) {
        const a = w[j];
        if (a === '--message' || /^-[A-Za-z]*m$/.test(a)) parts.push(value(w[++j] || ''));
        else if (a.startsWith('--message=')) parts.push(value(a.slice(10)));
        else if (a === '-F' || a === '--file') file = w[++j];
        else if (a.startsWith('--file=')) file = a.slice(7);
      }
      if (file === '-') parts.push(heredoc || ''); else if (file) { const t = readFile(file, cwd); if (t === null) return null; parts.push(t); }
      const text = tidy(parts.join('\n\n'));
      return text ? { kind: 'commit', text } : null;
    }
    if (w[0] === 'gh' && ['pr', 'issue'].includes(w[1]) && ['create', 'edit', 'comment'].includes(w[2])) {
      let title = '', body = '';
      for (let j = 3; j < w.length; j++) {
        const a = w[j];
        if (a === '--title' || a === '-t') title = value(w[++j] || '');
        else if (a.startsWith('--title=')) title = a.slice(8);
        else if (a === '--body' || a === '-b') body = value(w[++j] || '');
        else if (a.startsWith('--body=')) body = a.slice(7);
        else if (a === '--body-file' || a === '-F') { const f = w[++j]; const t = f === '-' ? heredoc : readFile(f, cwd); if (t === null) return null; body = t; }
      }
      const text = tidy([title, body].filter(Boolean).join('\n\n'));
      return text ? { kind: w[2] === 'comment' ? 'comment' : w[1], text } : null;
    }
  }
  return null;
}
module.exports = { messageOf, commands };
