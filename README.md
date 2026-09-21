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
