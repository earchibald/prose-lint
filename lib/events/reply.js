// Stop: lint the reply that just ended and add one line to the reply log. It never speaks to the session.
const fs = require('fs'); const { sentences } = require('../split'); const { append, slim } = require('./common');

// The last main-thread assistant line that holds text. Thinking, tool calls, and helper-agent lines are skipped.
function fromTranscript(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    let d; try { d = JSON.parse(lines[i]); } catch { continue; }
    if (d.type !== 'assistant' || d.isSidechain || !d.message || !Array.isArray(d.message.content)) continue;
    const text = d.message.content.filter(b => b.type === 'text').map(b => b.text).join('\n\n');
    if (text.trim()) return text;
  }
  return '';
}
module.exports = async function reply(input, ctx) {
  if (!ctx.cfg.replyLog || input.stop_hook_active) return null;
  let text = '', source = 'none';
  if (typeof input.last_assistant_message === 'string' && input.last_assistant_message.trim()) { text = input.last_assistant_message; source = 'last_assistant_message'; }
  else if (input.transcript_path) { try { text = fromTranscript(input.transcript_path); if (text) source = 'transcript'; } catch {} }
  const r = await ctx.check(text);
  append(ctx.files.chat, { event: input.hook_event_name, session: input.session_id, cwd: input.cwd, source, words: text.split(/\s+/).filter(Boolean).length, sentences: sentences(text).length, jev: r.jev, tokens: r.tokens, findings: r.findings.map(slim) });
  return null;
};
