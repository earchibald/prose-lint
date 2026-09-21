const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { judge } = require('../lib/jev');

const QS = { thing_acts: { version: 1, min: 0.7, type: 'noul', instructions: 'i', criteria: { true: 't', false: 'f' } },
  aphorism: { version: 1, min: 0.8, type: 'noul', instructions: 'i2' } };
// The network edge, faked. It scores a sentence 0.9 when it holds the word "carries", and records every call.
function fakeFetch(calls, status = 200) {
  return async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, auth: init.headers.Authorization, body });
    const answers = {}; for (const id of Object.keys(body.questions)) answers[id] = { type: 'noul', noul: /carries/.test(body.state.sentence) ? 0.9 : 0.1 };
    return { ok: status === 200, status, json: async () => ({ answers, usage: { input_tokens: 100 } }), text: async () => 'down' };
  };
}
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pl-')), 'cache.json');

test('one request for each sentence, with every question, and the key in the header', async () => {
  const calls = [];
  const r = await judge(['The soak carries the oracle.', 'Run the soak.'], QS, { fetch: fakeFetch(calls), key: 'K', cacheFile: tmp() });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].auth, 'Bearer K');
  assert.deepEqual(Object.keys(calls[0].body.questions).sort(), ['aphorism', 'thing_acts']);
  assert.equal(calls[0].body.questions.thing_acts.version, undefined, 'our own fields do not go to the service');
  assert.equal(calls[0].body.questions.thing_acts.min, undefined);
  assert.equal(r.scores['The soak carries the oracle.'].thing_acts, 0.9);
  assert.equal(r.scores['Run the soak.'].thing_acts, 0.1);
  assert.equal(r.tokens, 200);
});

test('a second run reads the cache and sends nothing', async () => {
  const cacheFile = tmp(); const calls = [];
  await judge(['The soak carries the oracle.'], QS, { fetch: fakeFetch(calls), key: 'K', cacheFile });
  const r = await judge(['The soak carries the oracle.'], QS, { fetch: fakeFetch(calls), key: 'K', cacheFile });
  assert.equal(calls.length, 1);
  assert.equal(r.scores['The soak carries the oracle.'].thing_acts, 0.9);
  assert.equal(r.tokens, 0);
});

test('a new question version asks again, for that question only', async () => {
  const cacheFile = tmp(); const calls = [];
  await judge(['The soak carries the oracle.'], QS, { fetch: fakeFetch(calls), key: 'K', cacheFile });
  const v2 = { ...QS, aphorism: { ...QS.aphorism, version: 2 } };
  await judge(['The soak carries the oracle.'], v2, { fetch: fakeFetch(calls), key: 'K', cacheFile });
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(calls[1].body.questions), ['aphorism']);
});

test('no key means no request, and the result says why', async () => {
  const calls = [];
  const r = await judge(['The soak carries the oracle.'], QS, { fetch: fakeFetch(calls), key: '', cacheFile: tmp() });
  assert.equal(calls.length, 0);
  assert.match(r.skipped, /no key/i);
});

test('a service failure does not throw, and the result says why', async () => {
  const r = await judge(['The soak carries the oracle.'], QS, { fetch: fakeFetch([], 401), key: 'K', cacheFile: tmp() });
  assert.match(r.skipped, /401/);
});
