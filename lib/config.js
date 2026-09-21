// The plugin's options. Claude Code passes each one to a hook or to the plugin's server as CLAUDE_PLUGIN_OPTION_<NAME>.
// A sensitive option, the key, is kept in the system keychain and reaches only those two kinds of process.
const fs = require('fs'); const path = require('path'); const os = require('os');
const yes = (v, d) => v === undefined || v === '' ? d : !/^(false|0|no|off)$/i.test(String(v));

function config(env = process.env) {
  const home = env.HOME || os.homedir(); const o = k => env['CLAUDE_PLUGIN_OPTION_' + k];
  let key = '';
  if (!env.PROSE_LINT_NO_JEV) {
    key = o('API_KEY') || env.TYPESAFE_API_KEY || '';
    // The key file is from the time before the plugin. It still works, so a terminal command can reach the judge.
    if (!key) try { const m = fs.readFileSync(path.join(home, '.config', 'prose-lint', 'env'), 'utf8').match(/^TYPESAFE_API_KEY=(.*)$/m); if (m) key = m[1].trim().replace(/^["']|["']$/g, ''); } catch {}
  }
  return {
    key, jev: !env.PROSE_LINT_NO_JEV,
    format: o('MESSAGE_FORMAT') === 'long' ? 'long' : 'short',
    writeFeedback: yes(o('WRITE_FEEDBACK'), true), replyLog: yes(o('REPLY_LOG'), true), sessionReport: yes(o('SESSION_REPORT'), true),
    commitCheck: o('COMMIT_CHECK') === 'off' ? 'off' : 'deny-once',
    // One folder for the logs and for your own rules. A terminal command, a hook, and the server must all agree on it.
    home: env.PROSE_LINT_HOME || path.join(home, '.claude', 'prose-lint'),
    cache: path.join(home, '.cache', 'prose-lint', 'jev.json'),
  };
}
module.exports = { config };
