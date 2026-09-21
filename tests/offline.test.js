const { test } = require('node:test');
const assert = require('node:assert/strict');
const { offline } = require('../lib/offline');
const rules = require('../rules.json');
const ids = s => offline(s, rules).map(f => f.rule);

test('a banned phrase is a hit, with its plain alternative', () => {
  const f = offline('This check is load-bearing for the merge.', rules);
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].rule, f[0].kind, f[0].match], ['phrase', 'hit', 'load-bearing']);
  assert.match(f[0].note, /essential|required/i);
});

test('a phrase matches whatever its case or hyphen', () => {
  assert.deepEqual(ids('It is Load Bearing here.'), ['phrase']);
  assert.deepEqual(ids('We delved into the log.'), ['phrase']);
});

test('a phrase inside inline code is not a hit', () => {
  assert.deepEqual(ids('The flag `load-bearing` is set in the file.'), []);
});

test('every phrase in the rule file matches its own example', () => {
  for (const p of rules.phrases) assert.deepEqual(ids(p.example).filter(r => r === 'phrase'), ['phrase'], p.example);
});

test('an em dash is a hit', () => {
  assert.deepEqual(ids('The run passed — nobody saw it.'), ['em-dash']);
});

test('a sentence over the word limit is a hit, and one at the limit is not', () => {
  const words = n => Array.from({ length: n }, (_, i) => 'w' + i).join(' ') + '.';
  assert.deepEqual(ids(words(rules.limits.sentenceWords)), []);
  const f = offline(words(rules.limits.sentenceWords + 1), rules);
  assert.deepEqual([f[0].rule, f[0].kind], ['long-sentence', 'hit']);
  assert.match(f[0].note, /26 words/);
});

test('a lifeless subject with an agent verb is a hint, because the verb list cannot see the subject', () => {
  const f = offline('The default soak carries the oracle.', rules);
  assert.deepEqual([f[0].rule, f[0].kind, f[0].match, f[0].ask], ['thing-acts', 'hint', 'carries', 'thing_acts']);
});

test('the maxim shape is a hint, in the positive and in the negative', () => {
  assert.deepEqual(ids('A skip is output nobody reads.'), ['x-is-a-y']);
  assert.deepEqual(ids('A test file is not a test run.'), ['x-is-a-y']);
  assert.deepEqual(ids('We ship it, because a sweep that finds nothing is a sweep that feels finished.'), ['x-is-a-y']);
});

test('a statement about one named thing is not the maxim shape', () => {
  assert.deepEqual(ids('The soak is six seeds for 70 days.'), []);
  assert.deepEqual(ids('`door.js` is the one way in from outside.'), []);
});

test('three short parallel items are a hint', () => {
  assert.deepEqual(ids('The result is faster, cleaner, and simpler.'), ['triplet']);
  assert.deepEqual(ids('It has two seeds and one flag.'), []);
});

test('a plain sentence has no findings', () => {
  assert.deepEqual(ids('Run the soak after every change to the core.'), []);
});

test('a phrase that ends in a comma or another mark still matches', () => {
  const r = { ...rules, phrases: [{ re: 'moving forward,', alt: 'cut it', example: 'Moving forward, we test.' }] };
  assert.deepEqual(offline('Moving forward, we test more.', r).map(f => f.rule), ['phrase']);
  assert.deepEqual(offline('The wolf is moving forward slowly.', r).map(f => f.rule), []);
  assert.deepEqual(offline('We are unloading the cart.', { ...rules, phrases: [{ re: 'load', alt: 'x', example: 'load' }] }).filter(f => f.rule === 'phrase'), [], 'a phrase inside a longer word does not match');
});
