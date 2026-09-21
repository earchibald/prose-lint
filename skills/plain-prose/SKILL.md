---
name: plain-prose
description: How to rewrite a sentence that Prose Lint marked. Use when a prose-lint message arrives with codes such as TP, DF, SA, HO, AN, RV, CO, PH, ED, LS, or TR, when the plugin stops a commit, or when the user asks for plain prose with no AI mannerisms.
---

# Rewrite a marked sentence

A plain sentence states a fact about a thing that you can name, or it gives a step. If a sentence would be just as true in any other project, cut it.

## What to do for each code

| Code | The fault | Marked | Plain |
|---|---|---|---|
| TP | A thing written as a person | The default soak carries the oracle. | The oracle runs only in the default soak. |
| DF | A saying in the form of a definition | A skip is output nobody reads. | Two tests printed a skip reason on every run. No reviewer read it. |
| SA | A quotable general truth | A guard that cannot fail protects nothing. | This guard passes for every input. Give it a case that fails. |
| HO | A claim of honesty | Here is my honest summary. | Give the summary. |
| AN | An announcement | Let me break down what is happening. | Start with the content. |
| RV | A staged reveal | The catch: nobody ever ran it. | No runner names this file, so it never ran. |
| CO | An opening compliment | Great question! | Start with the first fact. |
| PH | A banned phrase | This check is load-bearing. | Task 3 misses its budget without this check. |
| ED | An em dash | The run passed — nobody saw it. | The run passed. Nobody saw it. |
| LS | Over the word limit | One sentence of 40 words | Two sentences |
| TR | Three items for rhythm | Faster, cleaner, and simpler | The run takes 4 s, down from 15 s. |

## How to fix TP, the most common code

Find the verb that only a living thing can do: carry, ride, owe, earn, pay, travel, sit, live, land, hide, speak, agree, refuse, want, know. Then choose one of these:

- Say what the thing is or has. "The report has three findings."
- Make a person the subject. "I ran the soak", "a reviewer found it".
- Use the literal verb for that kind of thing. A test passes or fails. A function returns. A script prints.

A person, an animal, or a character in a game may do any of these acts.

## How to fix DF and SA

Both replace a fact with a general law. Ask: what happened here, to which named thing? Write that. If you have no such fact, cut the sentence.

A real definition is allowed. "An accrual marker is a tick on a record" tells the reader what a term means.

## After a rewrite

- Do not swap one marked pattern for another. A rewrite of SA often turns into RV.
- Do not change a fact, a number, a file name, or a command.
- Leave a sentence alone when it is a quotation, approved text, or a bad example in a table. When the plugin stops a commit for such a sentence, send the same text again, and it will pass.
- A title or a heading is a topic or a plain fact. It is not a saying.
