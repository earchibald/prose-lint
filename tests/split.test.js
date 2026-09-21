const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sentences, clauses } = require('../lib/split');

test('a sentence keeps the line it starts on', () => {
  const s = sentences('First one here now.\n\nSecond one is on line three.');
  assert.deepEqual(s.map(x => [x.line, x.text]), [[1, 'First one here now.'], [3, 'Second one is on line three.']]);
});

test('a code fence is not prose', () => {
  const s = sentences('Before the fence it is prose.\n```js\nconst a = "A guard is a thing that lies.";\n```\nAfter the fence it is prose.');
  assert.deepEqual(s.map(x => x.line), [1, 5]);
});

test('a table row and a heading are not prose', () => {
  const s = sentences('# A heading is a thing\n| a | b |\n|---|---|\n| The cell carries words. | x |\nOnly this line is prose here.');
  assert.deepEqual(s.map(x => x.text), ['Only this line is prose here.']);
});

test('a list marker is dropped and the item is kept', () => {
  assert.deepEqual(sentences('- The item is kept whole.\n2. So is this one here.').map(x => x.text), ['The item is kept whole.', 'So is this one here.']);
});

test('a paragraph wrapped over two lines is one sentence', () => {
  const s = sentences('This sentence starts on one line\nand ends on the next line.');
  assert.equal(s.length, 1);
  assert.equal(s[0].text, 'This sentence starts on one line and ends on the next line.');
});

test('a dot inside inline code does not end a sentence', () => {
  assert.equal(sentences('Run `node build.js` after every change to the source.').length, 1);
});

test('a long sentence splits into clauses, and a short one does not', () => {
  assert.deepEqual(clauses('The soak has six seeds.'), ['The soak has six seeds.']);
  const long = 'The soak\'s oracle is gated by a flag that nobody sets in the long run, and the flag needs the default length; so the default three-day soak carries the oracle.';
  const c = clauses(long);
  assert.ok(c.length >= 3, 'got ' + c.length);
  assert.equal(c[0], long, 'the whole sentence comes first');
  assert.ok(c.includes('so the default three-day soak carries the oracle.'), JSON.stringify(c));
});
