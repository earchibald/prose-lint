#!/usr/bin/env node
// The one program behind every hook of the plugin. Claude Code starts it with the event as JSON on stdin.
// It never fails a session: on any fault of its own it exits 0 and prints nothing.
const fs = require('fs');
const HANDLERS = { Stop: '../lib/events/reply', PostToolUse: '../lib/events/write', PreToolUse: '../lib/events/commit', SessionStart: '../lib/events/session' };
(async () => {
  let input; try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { if (process.env.PROSE_LINT_EVENT === 'Stop') { const { context, append } = require('../lib/events/common'); append(context().files.chat, { error: 'input is not JSON: ' + e.message }); } return; }
  const event = process.env.PROSE_LINT_EVENT || input.hook_event_name; if (!HANDLERS[event]) return;
  const { context } = require('../lib/events/common');
  const out = await require(HANDLERS[event])({ ...input, hook_event_name: input.hook_event_name || event }, context());
  if (out) process.stdout.write(JSON.stringify(out));
})().catch(() => {}).finally(() => { process.exitCode = 0; });
