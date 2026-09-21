# prose-lint

`prose-lint` finds assistant mannerisms in prose. It reads Markdown or plain text and prints each suspect line with the rule that matched.

| Layer | Network | Finds |
|---|---|---|
| Phrases | No | Exact banned phrases from `rules.json`. Headings and table cells are checked too. |
| Counted rules | No | An em dash. A sentence over 25 words. |
| Hints | No | Three shapes that a program can see but cannot confirm: an agent verb, "an X is a Y", and a list of three. |
| Judge | Yes | Pattern questions put to the Jev model, one request for each sentence. A judge answer replaces a hint. |

## Use

```
prose-lint report.md notes.md      # all layers
prose-lint --no-jev report.md      # offline layers only
git diff | prose-lint --json       # stdin in, JSON out
prose-lint --min 0.8 report.md     # one threshold for every question
```

The exit code is 0 for clean text, 1 for findings, and 2 when the tool cannot run.

The key is read from `TYPESAFE_API_KEY`, then from `~/.config/prose-lint/env`, then from `.env` in the current folder. With no key, the offline layers still run, and the last line of output says that the judge did not.

Judge answers are kept in `~/.cache/prose-lint/jev.json`. A second run over the same text sends nothing. When you change a question, raise its `version`, and the old answers for that question are asked again.

## The Stop hook

`hooks/stop-log.js` is a Claude Code Stop hook. It lints each reply as it ends and appends one line to `~/.claude/prose-lint/chat.jsonl`. It is log only. It prints nothing, it never blocks, and it always exits 0. A clean reply is logged too, so that a rate can be worked out.

`~/.claude/settings.json` names this script by its full path. If this folder moves, change that path, because a hook that cannot start fails without a message.

`prose-lint-log` prints a summary of the log. `prose-lint-log --since 2026-09-20` starts from a date.

## The write hook

`hooks/write-feedback.js` is a Claude Code PostToolUse hook for Write, Edit, and MultiEdit. It lints the new text of a prose file. If it finds a banned phrase, a counted fault, or a pattern that the judge confirms, it sends the findings back to the session that wrote the text. Each finding names the file, the line, the rule, and a way to fix the sentence.

The hook is silent for clean text, and it never fails the tool call. It does not send hints, because only the judge can confirm one. Every write is logged to `~/.claude/prose-lint/writes.jsonl`, hints included.

The `hook` section of `rules.json` controls the hook:

- `proseExtensions`: the hook reads only these file types. Source code is not read.
- `ignore`: a path that holds one of these strings is skipped. Approved game text is in this list, because it is used word for word.
- `ruleIgnore`: a rule that is off for some paths. The memory index keeps its em dash.
- `maxFindings`: the session gets this many findings, and a count of the others.

## Rules

`rules.json` holds every rule as data.

- `phrases`: a regular expression, a plain alternative, and an example that a test checks.
- `agentVerbs`: verbs that make a hint for the `thing_acts` question.
- `questions`: the judge questions. `min` is the score at which a question reports. `clauses` means a long sentence is also judged clause by clause, because a long sentence lowers the score of a pattern inside it.

No `min` value is calibrated yet. Each one is a starting mark from a small probe on 2026-09-20.

## Tests

```
npm test
```

The tests use a stand-in for the network. They send nothing to the service.
