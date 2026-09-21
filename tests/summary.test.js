const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarise } = require('../lib/summary');

const rows = [
  { event: 'Stop', session: 'install-check', sentences: 1, findings: [] },
  { event: 'Stop', session: 'a', sentences: 4, findings: [{ rule: 'thing_acts', kind: 'judge', score: 0.9, sentence: 'The soak carries the oracle.' }, { rule: 'phrase', kind: 'hit', match: 'load-bearing', sentence: 'It is load-bearing.' }] },
  { event: 'Stop', session: 'a', sentences: 6, findings: [] },
  { event: 'Stop', session: 'b', sentences: 10, findings: [{ rule: 'thing_acts', kind: 'judge', score: 0.75, sentence: 'A number travels.' }] },
  { error: 'input is not JSON' },
];

test('it counts replies, sentences, and the share of replies with a finding, and leaves out check rows and error rows', () => {
  const s = summarise(rows);
  assert.deepEqual([s.replies, s.sentences, s.repliesWithFindings, s.errors], [3, 20, 2, 1]);
});

test('each rule gets its count, its rate for each 100 sentences, and its highest-scored examples first', () => {
  const s = summarise(rows);
  assert.deepEqual(s.rules.map(r => [r.rule, r.count, r.per100]), [['thing_acts', 2, 10], ['phrase', 1, 5]]);
  assert.deepEqual(s.rules[0].examples, ['The soak carries the oracle.', 'A number travels.']);
});
