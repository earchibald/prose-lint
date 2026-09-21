---
name: rules
description: Change what Prose Lint looks for. Use when the user wants to ban a new phrase or a new writing pattern, stop a false alarm, make a rule stricter or looser, change the sentence word limit, keep the checks away from a file or a folder, or remove a rule.
argument-hint: "[what to ban, allow, or change]"
allowed-tools: mcp__plugin_prose-lint_prose-lint__try_rule mcp__plugin_prose-lint_prose-lint__status mcp__plugin_prose-lint_prose-lint__lint
---

# Change the rules

The request: $ARGUMENTS

## Where rules are kept

The rules that ship with the plugin are in `rules.json` in the plugin folder. Never edit that file. An update replaces it.

The user's own rules are in one file outside the plugin. Call `status` and read `rules.your_own_file` for its path. The plugin reads that file on top of its own rules, on every hook run, so a change needs no restart. [rules-file.md](rules-file.md) has the full format of the file.

## The procedure for every change

1. Call `status`. Note the path of the user's file and whether it exists.
2. Work out which job below the request is. If it could be two jobs, ask the user one question.
3. Draft the change. Test it with `try_rule` before you save anything. Use real sentences from the user's project where you can.
4. Show the user the draft and the test result. Save only when the test result is `ok`, or when the user accepts the misses by name.
5. Edit the user's file. Keep every entry that is already there. If the file does not exist, create it with only the new entry.
6. Call `status` again. `your_own_file_error` must be null. Then call `lint` on one sentence that should match, as the last proof.

## The jobs

### Ban a phrase

A phrase has fixed words, so plain code finds it. Add an entry to `phrases` with three fields. `re` is a regular expression without the word edges. `alt` is what to write in its place. `example` is a sentence that holds the phrase.

Give `try_rule` at least three sentences that should match and three that should not. The second group must hold the same words in an innocent use. "Moving forward, we test" is filler. "The wolf is moving forward" is not. If the innocent use matches, the fixed words are too common for a phrase rule. Make the expression narrower, for example tie it to the start of a sentence. If that fails, write a pattern question.

### Ban a pattern that has no fixed words

This needs a question for the judge model, and so it needs the key. Read "How to write a question" in [rules-file.md](rules-file.md) first. The judge reads a question literally, and a loose question marks half the page.

Add an entry to `questions` under a new id. Copy the fields of the `hedge_stack` example in [rules-file.md](rules-file.md). The `code` must be two letters that no other rule uses. Set `type` to `noul` and `version` to 1.

Give `try_rule` at least five sentences for each group. Read every score, not only `ok`. Set `min` between the lowest score that should match and the highest score that should not. If those two overlap, the question is not ready. Rewrite the `false` text to name the innocent cases that scored high, and test again.

### Stop a false alarm

Find the cause before you change anything. Call `lint` on the sentence and read the rule and the score.

- One sentence that is a quotation or approved text: change nothing. A write finding is advice, and a stopped commit passes on the second try.
- A whole file or folder that must not be checked: add part of its path to `hook.ignore`.
- A rule that is wrong for one file only: add the path under that rule in `hook.ruleIgnore`.
- A question that marks a whole kind of innocent sentence: copy the question into the user's file under its id. Add the innocent kind to the `false` text, and raise `version` by one. Test with `try_rule`.
- Scores that are only a little too high: raise `min` for that id. An entry such as `"aphorism": { "min": 0.9 }` changes only that value.

### Make a rule stricter or looser

Put only the id and the new `min` under `questions`. Then show the user two real sentences that the new value lets through, with their scores from `lint`.

### Change the word limit

Set `limits.sentenceWords`. The plugin's value is 25.

### Remove a rule

List a phrase by its `re` under `removePhrases`. List a question by its id under `disableQuestions`. The rule stays in the plugin, and the user's file turns it off.

### Change a question that the user added before

Edit the text, and raise its `version` by one. The plugin saves every judge answer by sentence, question, and version. With the old version number, the old answers would come back.

## What not to do

- Do not edit `rules.json` in the plugin folder.
- Do not save a rule that you did not test.
- Do not add a rule to fix one sentence. Add a rule only for a pattern that the user has seen more than once.
- Do not put the key, or any secret, in the rules file.
