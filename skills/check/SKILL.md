---
name: check
description: Check a file or a piece of text for machine-sounding sentences with the Prose Lint judge. Use when the user asks to lint, check, or proofread prose, asks "does this sound like AI", or wants a document checked before it ships.
argument-hint: "[file path, or text in quotes]"
allowed-tools: mcp__plugin_prose-lint_prose-lint__lint
---

# Check prose

Check this: $ARGUMENTS

If nothing is named above, check the prose file that you wrote or edited last in this session.

## Steps

1. Call the `lint` tool of the prose-lint server. Give `path` for a file, with its absolute path. Give `text` for text. The tool has the key for the judge, and a shell command does not. So do not run `prose-lint` through the shell for this job.
2. Read `judge` in the result. If it is not `ran`, tell the user that only phrases and counted rules were checked, and give the reason that the tool gave.
3. Leave out a finding whose `kind` is `hint` when the judge ran. Report a hint only when the judge did not run, and call it a hint.
4. Show the findings in a table: line, code, the marked words, and the fix. Put the highest scores first. Give the count for each code after the table.
5. Do not rewrite the text unless the user asks. If they ask, follow the `plain-prose` skill, and check your new text with `lint` before you show it.

## Scores

A judge score is a number from 0 to 1. No pass mark in this plugin is calibrated yet. A score from 0.70 to 0.79 for the code TP is often wrong, so say "possible" for those.

A sentence in a quotation, in approved text, or in a table of bad examples may be marked. Say so, and do not count it as a fault.
