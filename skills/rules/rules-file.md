# The user's rules file

The file is JSON. Every part is optional. The plugin reads it on top of its own `rules.json`.

```json
{
  "phrases": [
    { "re": "moving forward,", "alt": "cut it", "example": "Moving forward, we test more." }
  ],
  "removePhrases": ["tapestry"],
  "questions": {
    "aphorism": { "min": 0.9 },
    "hedge_stack": {
      "code": "HG", "legend": "stacked hedges: state it once, or cut it", "fix": "state the claim once, with its real limit",
      "type": "noul", "version": 1, "min": 0.8, "clauses": false,
      "instructions": "The sentence in `sentence` weakens one claim with two or more hedging words, such as may, might, perhaps, somewhat, or arguably.",
      "criteria": {
        "true": "Two or more hedges soften the same claim, and no reason for the doubt is given.",
        "false": "One hedge, or none. Or the doubt is real and the sentence gives its reason or its number."
      }
    }
  },
  "disableQuestions": ["affirmation"],
  "agentVerbs": ["inherits", "remembers"],
  "limits": { "sentenceWords": 30 },
  "hook": {
    "ignore": ["/drafts/", "/vendor/"],
    "proseExtensions": [".adoc"],
    "ruleIgnore": { "long-sentence": ["/legal/"] }
  }
}
```

| Part | Effect |
|---|---|
| `phrases` | Added to the plugin's phrases |
| `removePhrases` | Turns off a plugin phrase, named by its `re` |
| `questions` | An id that the plugin has: your fields replace its fields, one by one. A new id: a new question. |
| `disableQuestions` | Turns off a question, named by its id |
| `agentVerbs` | More verbs that make a hint for the code TP |
| `limits` | Replaces a limit |
| `hook.ignore` | A file whose path holds one of these strings is not checked when Claude writes it |
| `hook.proseExtensions` | More file types for the write check |
| `hook.ruleIgnore` | A rule that is off for paths that hold one of these strings |

The codes in use are PH, ED, LS, TR, TP, DF, SA, HO, AN, RV, and CO. A new question needs a code that is not in this list.

## How to write a question

The judge is Jev, a small model from TypeSafe. It answers one yes or no question about one sentence, and it returns a number from 0 to 1. It does not explain itself, and it does not write text.

1. **Ask one narrow thing.** "The sentence claims honesty for itself" works. "The sentence sounds like AI" does not, because it is five questions in one.
2. **Write it as a statement about `sentence`.** The sentence arrives in a field named `sentence`, so name that field in backticks.
3. **The judge reads every word literally.** It does not guess what you meant. If an innocent kind of sentence fits your words, it will be marked.
4. **Put most of your effort into the `false` text.** Name each innocent case that looks like the fault. The question for TP scored plain sentences high until its `false` text named "a test fails, a function returns, a script prints".
5. **The judge counts badly.** Do not ask "more than 25 words" or "three items". Plain code does those.
6. **Do not ask about anything outside the sentence.** The judge sees one sentence and nothing else. "Repeats the last paragraph" cannot work.
7. **Set `clauses` to true** when the fault can sit in one clause of a long sentence. The plugin then also judges each clause, and keeps the best score.

A good test set has the fault in short and in long sentences. Its innocent group holds the nearest innocent cases, not random sentences. "Esk carries the wood to the fire" tests TP well, because a person may carry.
