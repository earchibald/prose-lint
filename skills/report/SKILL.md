---
name: report
description: Report what the Prose Lint logs hold, such as how often each pattern appears in chat replies, file writes, and commit messages, and which sentences were marked. Use when the user asks how the writing is going, asks for prose-lint numbers or trends, or asks which patterns are most common.
argument-hint: "[replies | writes | commits] [since YYYY-MM-DD]"
allowed-tools: mcp__plugin_prose-lint_prose-lint__log_summary
---

# Report on the logs

The request: $ARGUMENTS

The plugin keeps three logs. `replies` holds every chat reply. `writes` holds every prose file that Claude wrote or edited. `commits` holds every commit message and every `gh` text, with a decision for each: allow, deny, or kept.

## Steps

1. Call `log_summary` once for each log that the request names. If it names none, call it for all three. Pass `since` when the user gives a date. For "this week", use the date seven days ago.
2. Give one table for each log: the rule, its code, the count, and the rate for each 100 sentences.
3. Under each table, quote the two highest-scored sentences for the top three rules. These are the user's evidence, so quote them exactly.
4. For `commits`, give the three decision counts. A high `kept` count means that sessions send a denied message again with no rewrite. Say so plainly if `kept` is more than a quarter of `deny`.
5. State the conditions beside each number: which log, since which date, and how many replies or sentences it covers.

Do not judge the writing as good or bad. Give the counts and the sentences, and stop.
