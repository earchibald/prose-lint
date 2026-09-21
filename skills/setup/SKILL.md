---
name: setup
description: Set up, check, or change the Prose Lint plugin. Use when the user asks whether prose-lint works, wants to set or change the judge key, wants to turn a piece on or off (file feedback, commit check, reply log, session report), wants the long or the short message form, or when a prose-lint hook seems silent.
allowed-tools: mcp__plugin_prose-lint_prose-lint__status mcp__plugin_prose-lint_prose-lint__lint
---

# Set up and check the plugin

The request: $ARGUMENTS

Start every job here with the `status` tool. It reports the key state, the options, the folders, the rule counts, and the time of the last line in each log. It never shows the key.

## The key for the judge

The key is a sensitive option named `api_key`. Claude Code keeps it in the system keychain. You cannot read it or set it, and you must not ask the user to paste it into the chat.

Tell the user to do one of these:

- In Claude Code, open `/plugin`, choose Prose Lint, and choose the option to configure it. Paste the key into the field "TypeSafe key for the judge".
- Or, in a terminal: `claude plugin enable prose-lint@earchibald-tools --config api_key=THE_KEY`

Then ask them to run `/reload-plugins`, and call `status` again. The `key` line must read "set, from the plugin option".

With no key, the plugin still checks banned phrases, em dashes, and long sentences. Say that, so the user knows what they have.

## The other options

These are not secret. They are in `~/.claude/settings.json`, under `pluginConfigs`, then the plugin's id, then `options`.

| Option | Values | What it does |
|---|---|---|
| `message_format` | `short`, `long` | `short` sends one line for each finding. `long` sends a full instruction with each. |
| `write_feedback` | true, false | Check a prose file when Claude writes or edits it |
| `commit_check` | `deny-once`, `off` | Stop a commit or a `gh` command once when its text has a finding |
| `reply_log` | true, false | Record each chat reply in a log |
| `session_report` | true, false | Give Claude four lines about its recent replies when a session starts |

To change one, the user can open `/plugin` and configure Prose Lint. If they ask you to do it, read `~/.claude/settings.json`, change only that one value, and keep everything else. Then ask them to run `/reload-plugins`.

To turn everything off in one step: `/plugin disable prose-lint@earchibald-tools`.

## Check that it works

1. `status` shows a key, and no `your_own_file_error`.
2. Call `lint` with the text `This check is load-bearing. A guard that cannot fail protects nothing.` You must get the code PH. With a key you must also get SA, with `judge` equal to `ran`.
3. Write a small Markdown file that holds the first of those sentences, in the system temp folder. A message from prose-lint must arrive right after the write. Delete the file.
4. Call `status` again. The `writes` time under `last_log_line` must be new.

If step 2 passes and step 3 is silent, the hooks did not load. Ask the user to run `/reload-plugins`, or to start a new session.

## An older install by hand

Before the plugin, the hooks were added by hand. Look in `~/.claude/settings.json` for a hook command that holds `prose-lint` or `001-prose-lint`, and for `"outputStyle": "Plain prose"`. With the plugin on, each of those runs a second time. Show the user the entries, and remove them only when they say yes. Make a dated copy of the settings file first.
