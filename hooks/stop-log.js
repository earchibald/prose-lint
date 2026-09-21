#!/usr/bin/env node
// Kept for a settings file that still names this script. The plugin uses hooks/dispatch.js for every event.
process.env.PROSE_LINT_EVENT = 'Stop';
require('./dispatch');
