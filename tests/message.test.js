const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { messageOf } = require('../lib/message');
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));

test('a command that writes no message for other people gives nothing', () => {
  for (const c of ['ls -la', 'git status', 'git log --grep="commit -m"', 'git commit --amend --no-edit', 'echo "git commit -m nope"'])
    assert.equal(messageOf(c, '/w'), null, c);
});

test('each -m of a commit is a paragraph of the message', () => {
  const m = messageOf(`git commit -m "Fix the stale cache" -m 'The wolf pick read an old list.'`, '/w');
  assert.deepEqual(m, { kind: 'commit', text: 'Fix the stale cache\n\nThe wolf pick read an old list.' });
});

test('a commit after cd, after git -C, and with -am is found', () => {
  assert.equal(messageOf('cd /w/x && git add -A && git commit -q -m "One line here"', '/w').text, 'One line here');
  assert.equal(messageOf('git -C /w/x commit -am "Second line here"', '/w').text, 'Second line here');
  assert.equal(messageOf('git commit --message="Third line here"', '/w').text, 'Third line here');
});

test('an escaped quote inside a double-quoted message stays in it', () => {
  assert.equal(messageOf('git commit -m "Say \\"no\\" to the old name"', '/w').text, 'Say "no" to the old name');
});

test('a heredoc is the message, for -F - and for $(cat <<EOF)', () => {
  const body = 'Add the gate\n\nIt reads every string.\n';
  assert.equal(messageOf(`git commit -q -F - <<'EOF'\n${body}EOF`, '/w').text, body.trim());
  assert.equal(messageOf(`git commit -m "$(cat <<'MSG'\n${body}MSG\n)"`, '/w').text, body.trim());
});

test('the attribution lines are not part of the prose', () => {
  const m = messageOf(`git commit -F - <<'EOF'\nAdd the gate\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>\nEOF`, '/w');
  assert.equal(m.text, 'Add the gate');
  assert.equal(messageOf(`gh pr create --title "T is here" --body "Body is here.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"`, '/w').text, 'T is here\n\nBody is here.');
});

test('a message file is read, relative to the working folder', () => {
  const dir = tmpdir(); fs.writeFileSync(path.join(dir, 'msg.txt'), 'From a file\n\nIt has a body.\n');
  assert.equal(messageOf('git commit -F msg.txt', dir).text, 'From a file\n\nIt has a body.');
  assert.equal(messageOf(`gh pr create --title "The title" --body-file ${path.join(dir, 'msg.txt')}`, '/w').text, 'The title\n\nFrom a file\n\nIt has a body.');
  assert.equal(messageOf('git commit -F missing.txt', dir), null);
});

test('a pull request, an issue, and a comment are read, and each gives its kind', () => {
  assert.deepEqual(messageOf('gh pr create --base dev -t "A title" -b "A body."', '/w'), { kind: 'pr', text: 'A title\n\nA body.' });
  assert.equal(messageOf('gh pr edit 12 --body "New body."', '/w').kind, 'pr');
  assert.equal(messageOf('gh issue create --title "An issue" --body "Its body."', '/w').kind, 'issue');
  assert.equal(messageOf('gh pr comment 12 --body "A comment."', '/w').kind, 'comment');
});
