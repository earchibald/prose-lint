// The judge layer. One request for each sentence, with every question that the cache cannot answer.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const URL_ = 'https://api.typesafe.ai/v1/systemone';
const keyOf = (s, id, q) => crypto.createHash('sha256').update([s, id, q.version].join('\u0000')).digest('hex').slice(0, 24);

function readCache(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
function writeCache(file, cache) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(cache)); }

async function post(fetch_, key, body) {
  for (let t = 0; ; t++) {
    const r = await fetch_(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && t < 4) { await new Promise(s => setTimeout(s, 400 * 2 ** t)); continue; }
    throw new Error('the service answered ' + r.status);
  }
}

async function judge(sentences, questions, { fetch: fetch_ = fetch, key, cacheFile, model = 'jev-latest', parallel = 12 }) {
  const cache = readCache(cacheFile); const scores = {}; const jobs = []; let tokens = 0;
  for (const s of [...new Set(sentences)]) {
    scores[s] = {}; const ask = {};
    for (const [id, q] of Object.entries(questions)) {
      const hit = cache[keyOf(s, id, q)];
      if (hit !== undefined) scores[s][id] = hit;
      else { const { version, min, clauses, ...wire } = q; ask[id] = wire; }
    }
    if (Object.keys(ask).length) jobs.push({ s, ask });
  }
  if (!jobs.length) return { scores, tokens };
  if (!key) return { scores, tokens, skipped: 'no key: set TYPESAFE_API_KEY' };
  try {
    let i = 0;
    await Promise.all(Array.from({ length: parallel }, async () => {
      while (i < jobs.length) {
        const { s, ask } = jobs[i++];
        const r = await post(fetch_, key, { state: { sentence: s }, model, questions: ask });
        tokens += r.usage ? r.usage.input_tokens : 0;
        for (const id of Object.keys(ask)) { const a = r.answers[id]; const v = a.noul !== undefined ? a.noul : a.score; scores[s][id] = v; cache[keyOf(s, id, questions[id])] = v; }
      }
    }));
  } catch (e) { writeCache(cacheFile, cache); return { scores, tokens, skipped: String(e.message || e) }; }
  writeCache(cacheFile, cache);
  return { scores, tokens };
}
module.exports = { judge };
