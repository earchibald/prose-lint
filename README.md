# Prose Lint

Prose Lint is a Claude Code plugin. It marks the sentences in Claude's writing that sound like a machine wrote them. It checks the prose files, commit messages, and pull requests that Claude writes, and it records Claude's chat replies. It tells Claude what it found, so that Claude writes the sentence again in plain words. It is for people who use Claude Code and read what Claude writes.

| | |
|---|---|
| Marked | The default three-day soak **carries** the oracle. |
| Why | The sentence gives a test run an act, as if it were a person. The reader must work out what is meant. |
| Plain | The oracle runs only in the default three-day soak. |

## User guide

The [Prose Lint User Guide](https://claude.ai/artifact/DWck5Nc1Bqu7xe1au8c21j) covers everything in this file, and also the skills, the rules, the command line, the design, and the measurements. Its source is [`docs/guide.html`](docs/guide.html).

## Installation

### Before you start

- Claude Code.
- Node 22 or newer, as `node` on your path. The plugin uses no outside packages.
- Read access to this repo.
- A key from TypeSafe, if you want the judge. The judge is Jev, a small AI model that scores each sentence. Without a key, the plugin still finds banned phrases, em dashes, and long sentences.

> **Do not paste the key into a chat with Claude.** Claude Code saves each chat in a transcript. Give the key only in the install command below, or on the configure screen. Both send it straight to the system keychain.

Run these two commands in a terminal:

```
claude plugin marketplace add earchibald/claude-marketplace
claude plugin install prose-lint@earchibald-plugins --config api_key=YOUR_TYPESAFE_KEY
```

The install says that five options are "not yet set". Each has a default, so you have nothing more to do. Then start a new session, because a session that is already open keeps its old hooks.

To change an option, run `/plugin configure prose-lint@earchibald-plugins` in Claude Code. To turn the plugin off, run `/plugin disable prose-lint@earchibald-plugins`.

## Quickstart

Do the test in a folder whose path does not hold `/prose-lint/`. The write check skips any such path, so a test inside this repo gives no message.

1. Install the plugin with the two commands above.
2. Start a new session in a scratch folder.
3. Ask Claude: "Write t.md with one line: This check is load-bearing."
4. Look for the message. It arrives right after the write, and Claude rewrites the sentence:

   ```
   prose-lint t.md: 1 to fix
   L1 PH "load-bearing"
   PH banned phrase: use the plain word.
   ```

5. Type `/prose-lint:check t.md` to check a file on request. Without a key, this step shows only banned phrases, em dashes, and long sentences.
6. Ask "is prose-lint working?" The `setup` skill runs four steps and reports each one.

If step 4 gives no message, check three things. The session must have started after the install. The file must end in `.md`, `.mdx`, `.markdown`, `.txt`, or `.rst`. The path must not be on the ignore list.

## Licence

MIT. See [LICENSE](LICENSE).
