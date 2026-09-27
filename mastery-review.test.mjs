import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Override only the fixture directory to exercise the sibling trial artifact.
const root = resolve(process.env.TCM_REVIEW_DIR || fileURLToPath(new URL('.', import.meta.url)));
const edition = basename(root);
const expected = {
  'zhongyi-review-test': {count: 814, prefix: 'tcm-review-test:v1', modules: [374, 277, 99, 64]},
  'zhongyi-review-trial': {count: 111, prefix: 'tcm-review-trial:v1', modules: [37, 37, 20, 17]},
}[edition];
assert.ok(expected, 'Select an existing full or trial directory');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1);
const script = new vm.Script(scripts[0][1], {filename: `${edition}/index.html`});
const data = JSON.parse(readFileSync(resolve(root, 'data/review_items.json'), 'utf8'));
const report = JSON.parse(readFileSync(resolve(root, 'data/extraction_report.json'), 'utf8'));
const modules = [...new Map(data.map(item => [`${item.subject}:${item.module}`, item])).values()];
const keyFor = item => `${expected.prefix}:${item.subject}:${item.module}`;
const blankState = () => ({done: 0, know: 0, review: [], mastered: [], favorite: []});

// Run the unmodified page script and its real fetch/render startup. Only browser
// boundaries are simulated; state transitions, persistence and rendering are real.
async function app(store = new Map(), responses = {}, options = {}) {
  const nodes = new Map();
  function element() {
    const children = new Map();
    const classes = new Set();
    return {
      value: '', textContent: '', innerHTML: '', hidden: true, disabled: false,
      style: {}, attributes: {}, listeners: {},
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, force = !classes.has(value)) { if (force) classes.add(value); else classes.delete(value); },
      },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      addEventListener(name, handler) { this.listeners[name] = handler; },
      querySelector(selector) {
        if (!children.has(selector)) children.set(selector, element());
        return children.get(selector);
      },
      focus() {}, scrollIntoView() {},
    };
  }
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, element());
  const node = id => {
    assert.ok(nodes.has(id), `Missing actual HTML element: ${id}`);
    return nodes.get(id);
  };
  node('poolSelect').value = 'all';
  node('modeSelect').value = 'forward';
  const writes = [];
  const context = vm.createContext({
    document: {getElementById: node, querySelectorAll: () => [], body: element(), addEventListener() {}},
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem(key, value) { if (options.denyWrites) throw new Error('storage denied'); writes.push(key); store.set(key, String(value)); },
    },
    window: {setTimeout: fn => fn(), matchMedia: () => ({matches: true})},
    fetch: async url => {
      assert.ok(['data/review_items.json', 'data/extraction_report.json'].includes(url));
      if (responses[url]) return responses[url]();
      return {ok: true, json: async () => structuredClone(url.includes('review_items') ? data : report)};
    },
  });
  let startupError;
  if (options.noObjectHasOwn) vm.runInContext('Object.hasOwn = undefined', context);
  try { await script.runInContext(context); } catch (error) { startupError = error; }
  // Drain the optional report's independent fetch/parse continuation.
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const run = source => vm.runInContext(source, context);
  const json = source => JSON.parse(run(`JSON.stringify(${source})`));
  return {
    node, store, writes, run, json, startupError,
    state: () => json('loadState()'),
    select(item, pool = 'all') {
      node('poolSelect').value = pool;
      run(`activeSubject = ${JSON.stringify(item.subject)}; activeModule = ${JSON.stringify(item.module)};
        activeCategory = ${JSON.stringify(item.category)}; pick(${JSON.stringify(item.id)});`);
    },
    mark(action) { node(action === 'know' ? 'knowBtn' : 'againBtn').listeners.click(); },
  };
}

// Phase 3 fault injection stays at the storage/fetch boundaries.
const response = value => async () => ({ok: true, json: async () => structuredClone(value)});
const coreUrl = 'data/review_items.json';
const reportUrl = 'data/extraction_report.json';

// Literal expectations from the reviewed removed/added IDs and merge evidence.
const legacyPairs = [
  ['fangji-189-大黄廑虫丸', 'fangji-189-大黄䗪虫丸'],
  ['fangji-242-萆薛分清饮', 'fangji-242-萆薢分清饮'],
  ['fangji-266-葛花解醒汤', 'fangji-266-葛花解酲汤'],
  ['zhenjiu-point-050-颧醪', 'zhenjiu-point-050-颧髎'],
  ['zhenjiu-point-068-肩醪', 'zhenjiu-point-068-肩髎'],
  ['zhenjiu-point-073-瞳子醪', 'zhenjiu-point-073-瞳子髎'],
  ['zhenjiu-treatment-023-泄泻-急性泄泻', 'zhenjiu-treatment-021-泄泻-急性泄泻'],
  ['zhenjiu-treatment-024-泄泻-慢性泄泻', 'zhenjiu-treatment-022-泄泻-慢性泄泻'],
  ['zhenjiu-treatment-028-癃闭-实证', 'zhenjiu-treatment-026-癃闭-实证'],
  ['zhenjiu-treatment-029-癃闭-虚证', 'zhenjiu-treatment-027-癃闭-虚证'],
  ['zhenjiu-treatment-032-痹证', 'zhenjiu-treatment-031-痹证'],
  ['zhenjiu-treatment-050-炸腮', 'zhenjiu-treatment-050-痄腮'],
  ['zhenjiu-treatment-051-疙腮', 'zhenjiu-treatment-050-痄腮'],
  ['zhenjiu-treatment-054-扭伤', 'zhenjiu-treatment-053-扭伤'],
  ['zhenjiu-treatment-055-扭伤', 'zhenjiu-treatment-053-扭伤'],
  ['zhenjiu-treatment-056-扭伤', 'zhenjiu-treatment-053-扭伤'],
  ['zhenjiu-treatment-058-项痹', 'zhenjiu-treatment-057-项痹'],
  ['zhenjiu-treatment-075-胆道蛔虫症', 'zhenjiu-treatment-074-胆道蛔虫症'],
];
const fullFixture = JSON.parse(readFileSync(new URL('data/review_items.json', import.meta.url), 'utf8'));
test(`${edition}: migration allowlist accounts for all removed IDs except excluded 滚痰丸`, () => {
  const evidence=JSON.parse(readFileSync(new URL('data/correction_report.json',import.meta.url),'utf8'));
  assert.equal(legacyPairs.length,18);
  assert.deepEqual(new Set([...legacyPairs.map(([id])=>id),'fangji-253-滚痰丸']),new Set(evidence.removed.map(x=>x.id)));
  const targets=new Set(legacyPairs.map(([,id])=>id));
  assert.equal(targets.size,15);
  assert.ok(evidence.added.every(x=>targets.has(x.id)));
  assert.ok([...targets].every(id=>fullFixture.some(x=>x.id===id)));
});
for (const [oldId, newId] of legacyPairs) {
  const target = fullFixture.find(x => x.id === newId);
  const inScope = data.some(x => x.id === newId);
  for (const field of ['mastered','review','favorite']) {
    test(`${edition}: legacy ${field} ${oldId} maps only to its in-scope exact target and persists`, async () => {
      const initial = {...blankState(), done: 17, know: 9, [field]: [oldId], extra: 'keep'};
      const store = new Map([[keyFor(target), JSON.stringify(initial)], ['unrelated', 'untouched']]);
      const a = await app(store);
      assert.equal(a.startupError, undefined);
      const want = {...initial, [field]: [inScope ? newId : oldId]};
      assert.deepEqual(JSON.parse(store.get(keyFor(target))), want);
      assert.equal(store.get('unrelated'), 'untouched');
      const reloaded = await app(store);
      assert.equal(reloaded.startupError, undefined);
      assert.deepEqual(JSON.parse(store.get(keyFor(target))), want);
      assert.equal(reloaded.writes.length, 0, 'Migration must be idempotent');
      if (inScope) {
        reloaded.select(target, field === 'favorite' ? 'favorite' : 'all');
        assert.equal(reloaded.run('current.id'), newId);
        assert.deepEqual(reloaded.state()[field], [newId]);
      } else assert.equal(a.writes.length, 0);
    });
  }
  test(`${edition}: legacy custom answer ${oldId} transfers only in scope and does not resurrect after restore`, async () => {
    const key = `${expected.prefix}:custom-answers`;
    const a = await app(new Map([[key, JSON.stringify({[oldId]: 'my old answer', untouched: 'preserve'})]]));
    assert.equal(a.startupError, undefined);
    assert.deepEqual(JSON.parse(a.store.get(key)), {[inScope ? newId : oldId]: 'my old answer', untouched: 'preserve'});
    if (inScope) {
      a.select(target); assert.equal(a.run('directAnswerFor(current)'), 'my old answer');
      a.node('restoreAnswerBtn').listeners.click();
      const reloaded = await app(a.store); reloaded.select(target);
      assert.equal(reloaded.run('directAnswerFor(current)'), target.primaryAnswer);
      assert.equal(reloaded.json('customAnswers')[oldId], undefined);
    }
  });
}

const sprainTarget = fullFixture.find(x => x.id === 'zhenjiu-treatment-053-扭伤');
const oldSprains = ['zhenjiu-treatment-054-扭伤','zhenjiu-treatment-055-扭伤','zhenjiu-treatment-056-扭伤'];
const sprainInScope = data.some(x => x.id === sprainTarget.id);
test(`${edition}: merged IDs deduplicate and review takes precedence only for migrated overlaps`, async () => {
  const initial = {...blankState(), mastered: [oldSprains[0]], review: [oldSprains[1],sprainTarget.id], favorite: [...oldSprains,sprainTarget.id], done: 23, know: 12};
  const a = await app(new Map([[keyFor(sprainTarget), JSON.stringify(initial)]]));
  assert.deepEqual(JSON.parse(a.store.get(keyFor(sprainTarget))), sprainInScope ? {...initial, mastered: [], review: [sprainTarget.id], favorite: [sprainTarget.id]} : initial);
  const again = await app(a.store);
  assert.equal(again.writes.length, 0);
  if (sprainInScope) { again.select(sprainTarget); again.mark('know'); assert.deepEqual(again.state().review, []); }
});

for (const conflict of [false,true]) test(`${edition}: merged custom answers ${conflict ? 'conflict is preserved without guessing' : 'identical values collapse safely'}`, async () => {
  const key = `${expected.prefix}:custom-answers`;
  const initial = {[oldSprains[0]]: 'answer A', [oldSprains[1]]: conflict ? 'answer B' : 'answer A'};
  const a = await app(new Map([[key,JSON.stringify(initial)]]));
  const stored = JSON.parse(a.store.get(key));
  if (sprainInScope && conflict) {
    for (const [id,value] of Object.entries(initial)) assert.equal(stored[id],value);
    assert.equal(stored[sprainTarget.id],undefined);
  } else assert.deepEqual(stored, sprainInScope ? {[sprainTarget.id]:'answer A'} : initial);
});

test(`${edition}: existing different current answer is never overwritten by legacy answer`, async () => {
  const key = `${expected.prefix}:custom-answers`;
  const initial = {[oldSprains[0]]:'old answer',[sprainTarget.id]:'current answer'};
  const a = await app(new Map([[key,JSON.stringify(initial)]]));
  for (const [id,value] of Object.entries(initial)) assert.equal(JSON.parse(a.store.get(key))[id],value);
});

test(`${edition}: conflicting legacy custom answer never resurrects after restore or other edits`, async () => {
  const key = `${expected.prefix}:custom-answers`;
  const initial = {[oldSprains[0]]:'old conflicting answer',[sprainTarget.id]:'current answer'};
  const a = await app(new Map([[key,JSON.stringify(initial)]]));
  if (!sprainInScope) { assert.deepEqual(JSON.parse(a.store.get(key)),initial); return; }
  a.select(data[0]);a.node('customText').value='another personal answer';a.node('customSaveBtn').listeners.click();
  a.select(sprainTarget);a.node('restoreAnswerBtn').listeners.click();
  const reloaded=await app(a.store);reloaded.select(sprainTarget);
  assert.equal(reloaded.run('directAnswerFor(current)'),sprainTarget.primaryAnswer);
  assert.equal(JSON.parse(a.store.get(key))[oldSprains[0]],'old conflicting answer');
  assert.equal(JSON.parse(a.store.get(key))[data[0].id],'another personal answer');
  assert.equal(reloaded.writes.length,0);
});

test(`${edition}: migration write failure preserves originals and can retry after refresh`, async () => {
  const key=keyFor(sprainTarget), customKey=`${expected.prefix}:custom-answers`;
  const store=new Map([[key,JSON.stringify({...blankState(),favorite:oldSprains})],[customKey,JSON.stringify({[oldSprains[0]]:'old answer'})]]);
  const before=new Map(store);
  const a=await app(store,{}, {denyWrites:true});assert.equal(a.startupError,undefined);assert.deepEqual(store,before);
  const retry=await app(store);assert.equal(retry.startupError,undefined);
  assert.deepEqual(JSON.parse(store.get(key)).favorite,sprainInScope ? [sprainTarget.id] : oldSprains);
});

test(`${edition}: migration does not require newer Object.hasOwn browser API`, async () => {
  const key=`${expected.prefix}:custom-answers`;
  const a=await app(new Map([[key,JSON.stringify({[oldSprains[0]]:'legacy'})]]),{}, {noObjectHasOwn:true});
  assert.equal(a.startupError,undefined);
  assert.equal(JSON.parse(a.store.get(key))[sprainInScope ? sprainTarget.id : oldSprains[0]],'legacy');
});

test(`${edition}: excluded or unknown IDs and unrelated namespaces remain unmigrated`, async () => {
  const state={...blankState(),mastered:['fangji-253-滚痰丸','unknown-id'],favorite:['fangji-253-滚痰丸']};
  const store=new Map([
    [`${expected.prefix}:方剂:方剂`,JSON.stringify(state)],
    [`${expected.prefix}:custom-answers`,JSON.stringify({'fangji-253-滚痰丸':'keep me'})],
    ['herb-review-state','paid sentinel'],
    ['tcm-review-unrelated:v1:方剂:方剂',JSON.stringify({favorite:[legacyPairs[0][0]]})],
  ]);
  const before=new Map(store);const a=await app(store);
  assert.equal(a.startupError,undefined);assert.deepEqual(store,before);assert.equal(a.writes.length,0);
});

test(`${edition}: invalid core data must not trigger any migration`, async () => {
  const store=new Map([[keyFor(sprainTarget),JSON.stringify({...blankState(),favorite:oldSprains})]]);
  const before=new Map(store);const a=await app(store,{[coreUrl]:response(null)});
  assert.equal(a.startupError,undefined);assert.deepEqual(store,before);assert.equal(a.writes.length,0);
});

test(`${edition}: current edition badge matches actual data count`, () => {
  const badge = html.match(/class="edition-badge">([^<]+)</)[1];
  assert.match(badge, new RegExp(`\\b${data.length} 题`));
});

test(`${edition}: displayed source counts match current candidate, including trial fallback`, async () => {
  const a = await app(new Map(), {[reportUrl]: response({...report, fullCounts: undefined})});
  assert.equal(a.startupError, undefined);
  const summary = a.node('sourceSummary').textContent;
  for (const [label, count] of [['中药',374],['方剂',277],['针灸穴位',99],['针灸病证选穴',64]]) {
    assert.ok(summary.includes(`${label} ${count} 条`), `${label}: ${summary}`);
  }
  if (edition === 'zhongyi-review-trial') for (const [label,count] of [['中药',37],['方剂',37],['针灸穴位',20],['针灸病证选穴',17]]) assert.ok(summary.includes(`${label} ${count} 条`));
});

for (const field of ['done', 'know', 'review', 'mastered', 'favorite']) {
  for (const bad of [null, 'wrong', {}, {toString: null, valueOf: null}, ...(field === 'done' || field === 'know' ? [[], -1, 1.5] : [42])]) {
    test(`${edition}: storage ${field} rejects ${JSON.stringify(bad)} without losing other fields`, async () => {
      const first = data[0];
      const valid = {...blankState(), done: 12, know: 7, favorite: [first.id], extra: 'keep'};
      const store = new Map([[keyFor(first), JSON.stringify({...valid, [field]: bad})], ['other-key', 'untouched']]);
      const before = new Map(store);
      const a = await app(store);
      assert.equal(a.startupError, undefined);
      assert.ok(a.run('current'));
      assert.deepEqual(a.state(), {...valid, [field]: blankState()[field]});
      assert.deepEqual(store, before, 'Recovery must not erase or eagerly rewrite stored data');
      a.select(first); a.mark('know');
      assert.equal(a.state().extra, 'keep');
      assert.equal(store.get('other-key'), 'untouched');
      assert.ok(Number.isSafeInteger(a.state().done));
    });
  }
}

for (const raw of ['{', 'null', '[]', '"wrong"', '42', '{}']) {
  test(`${edition}: malformed/top-level storage ${raw} and missing optional fields recover`, async () => {
    const a = await app(new Map([[keyFor(data[0]), raw]]));
    assert.equal(a.startupError, undefined);
    assert.deepEqual(a.state(), blankState());
    assert.ok(a.run('current'));
  });
}

test(`${edition}: invalid list entries are removed without losing valid IDs or cumulative stats`, async () => {
  const id = data[0].id;
  const mixed = [id, null, {}, [], 1, '', id];
  const a = await app(new Map([[keyFor(data[0]), JSON.stringify({done: 12, know: 7, review: mixed, mastered: mixed, favorite: mixed})]]));
  assert.equal(a.startupError, undefined);
  assert.deepEqual(a.state(), {done: 12, know: 7, review: [id], mastered: [id], favorite: [id]});
});

for (const bad of [[], {}, 17, true, null, '']) {
  test(`${edition}: invalid custom answer ${JSON.stringify(bad)} preserves other custom answers`, async () => {
    const key = `${expected.prefix}:custom-answers`;
    const raw = JSON.stringify({[data[0].id]: bad, [data[1].id]: 'valid personal answer'});
    const a = await app(new Map([[key, raw]]));
    assert.equal(a.startupError, undefined);
    a.select(data[0]);
    assert.equal(a.run('directAnswerFor(current)'), data[0].primaryAnswer);
    a.select(data[1]);
    assert.equal(a.run('directAnswerFor(current)'), 'valid personal answer');
    assert.equal(a.store.get(key), raw);
  });
}

test(`${edition}: valid storage and optional preferences remain compatible`, async () => {
  const state = {...blankState(), done: 19, know: 8, favorite: [data[0].id], extra: {keep: true}};
  const a = await app(new Map([[keyFor(data[0]), JSON.stringify(state)], [`${expected.prefix}:preferences`, '{"showCategoryHint":true}']]));
  assert.equal(a.startupError, undefined);
  assert.deepEqual(a.state(), state);
  assert.equal(a.run('preferences.showCategoryHint'), true);
  assert.equal(a.writes.length, 0);
});

test(`${edition}: missing optional state fields do not discard existing progress`, async () => {
  const a = await app(new Map([[keyFor(data[0]), JSON.stringify({done: 12, mastered: [data[0].id]})]]));
  assert.equal(a.startupError, undefined);
  assert.deepEqual(a.state(), {...blankState(), done: 12, mastered: [data[0].id]});
  assert.equal(a.writes.length, 0);
});

for (const raw of ['{', 'null', '[]', '"wrong"']) {
  test(`${edition}: malformed custom-answer/preferences containers ${raw} do not block review`, async () => {
    const a = await app(new Map([[`${expected.prefix}:custom-answers`, raw], [`${expected.prefix}:preferences`, raw]]));
    assert.equal(a.startupError, undefined);
    a.select(data[0]);
    assert.equal(a.run('directAnswerFor(current)'), data[0].primaryAnswer);
    assert.equal(a.run('preferences.showCategoryHint'), false);
    assert.equal(a.writes.length, 0);
  });
}

test(`${edition}: core optional display fields may be absent without blocking review`, async () => {
  const minimal = {...data[0]};
  for (const key of ['extra', 'reversePrompt', 'primaryLabel', 'source']) delete minimal[key];
  const a = await app(new Map(), {[coreUrl]: response([minimal])});
  assert.equal(a.startupError, undefined);
  assert.equal(a.run('current.id'), minimal.id);
  a.node('modeSelect').value = 'reverse'; a.run('pick()');
  assert.equal(a.node('promptName').textContent, minimal.primaryAnswer);
  a.node('revealBtn').listeners.click();
  assert.equal(a.run('revealed'), true);
});

const invalidCore = [
  ['invalid JSON', async () => ({ok: true, json: async () => JSON.parse('{')})],
  ['missing file', async () => ({ok: false, status: 404})],
  ['network failure', async () => { throw new TypeError('fetch failed'); }],
  ...[null, {}, 'wrong', [], [null]].map(value => [JSON.stringify(value), response(value)]),
  ['duplicate IDs', response([data[0], data[0]])],
  ['invalid extra', response([{...data[0], extra: []}])],
  ['invalid reverse prompt', response([{...data[0], reversePrompt: {}}])],
  ['unknown subject/module', response([{...data[0], module: 'unknown'}])],
];
for (const field of ['id', 'subject', 'module', 'name', 'category', 'primaryAnswer']) {
  for (const bad of [undefined, '', {}]) invalidCore.push([`${field}=${JSON.stringify(bad)}`, response([data[0], {...data[1], [field]: bad}])]);
}
for (const [label, fetchResponse] of invalidCore) {
  test(`${edition}: core ${label} fails closed without partial questions or unhandled rejection`, async () => {
    const a = await app(new Map([['other-key', 'keep']]), {[coreUrl]: fetchResponse});
    assert.equal(a.startupError, undefined);
    assert.deepEqual(a.json('items'), []);
    assert.equal(a.run('current'), null);
    assert.equal(a.node('promptName').textContent, '数据加载失败');
    assert.match(a.node('answerBox').innerHTML, /题库/);
    for (const id of ['knowBtn', 'againBtn', 'favoriteBtn', 'editAnswerBtn', 'nextBtn', 'revealBtn']) assert.equal(a.node(id).disabled, true, id);
    a.mark('know'); a.mark('again'); a.run('pick()');
    assert.equal(a.node('promptName').textContent, '数据加载失败');
    assert.equal(a.run('current'), null);
    assert.equal(a.writes.length, 0);
    assert.equal(a.store.get('other-key'), 'keep');
  });
}

for (const [label, fetchResponse] of [
  ['404', async () => ({ok: false, status: 404})],
  ['invalid JSON', async () => ({ok: true, json: async () => JSON.parse('{')})],
  ['network rejection', async () => { throw new TypeError('fetch failed'); }],
  ...[null, [], {counts: []}].map(value => [JSON.stringify(value), response(value)]),
]) {
  test(`${edition}: auxiliary ${label} is nonblocking and does not mislabel core data as failed`, async () => {
    const a = await app(new Map(), {[reportUrl]: fetchResponse});
    assert.equal(a.startupError, undefined);
    assert.equal(a.run('items.length'), expected.count);
    assert.ok(a.run('current'));
    assert.match(a.node('sourceSummary').textContent, /报告.*未能加载/);
    a.select(data[0]); a.mark('know');
    assert.deepEqual(a.state().mastered, [data[0].id]);
  });
}

test(`${edition}: pending auxiliary report cannot delay core review startup`, async () => {
  let resolveReport;
  const pending = new Promise(resolve => { resolveReport = resolve; });
  const startup = app(new Map(), {[reportUrl]: () => pending});
  const a = await Promise.race([startup, new Promise(resolve => setTimeout(() => resolve(null), 100))]);
  resolveReport({ok: true, json: async () => report});
  await startup;
  assert.ok(a, 'Core review must initialize before auxiliary report resolves');
  assert.ok(a.run('current'));
});

function assertMembership(a, item, mastered, review) {
  const state = a.state();
  assert.equal(state.mastered.filter(id => id === item.id).length, mastered);
  assert.equal(state.review.filter(id => id === item.id).length, review);
  assert.equal(new Set(state.mastered).size, state.mastered.length);
  assert.equal(new Set(state.review).size, state.review.length);
  assert.equal(a.json('categoryData()').reduce((sum, row) => sum + row.done, 0), mastered);
}

test(`${edition}: current corrected scope and unique item IDs remain intact`, () => {
  assert.equal(data.length, expected.count);
  assert.equal(new Set(data.map(item => item.id)).size, expected.count);
  assert.equal(modules.length, 4);
  assert.deepEqual(modules.map(({subject, module}) => data.filter(item => item.subject === subject && item.module === module).length), expected.modules);
});

for (const item of modules) {
  for (const [label, before, action, mastered, review] of [
    ['unknown to mastered', {}, 'know', 1, 0],
    ['unknown to review', {}, 'again', 0, 1],
    ['mastered to review', {mastered: [item.id]}, 'again', 0, 1],
    ['review to mastered', {review: [item.id]}, 'know', 1, 0],
  ]) {
    test(`${edition}: ${item.subject}/${item.module} ${label}`, async () => {
      const a = await app(new Map([[keyFor(item), JSON.stringify({...blankState(), ...before})]]));
      a.select(item);
      a.mark(action);
      assertMembership(a, item, mastered, review);
      assert.equal(Number(a.node('reviewCount').textContent), review);
      assert.equal(a.state().done, 1);
      assert.equal(a.state().know, action === 'know' ? 1 : 0);
    });
  }
}

const item = data[0];
for (const action of ['know', 'again']) {
  test(`${edition}: repeated ${action} does not duplicate membership or inflate current counts`, async () => {
    const a = await app();
    for (let i = 0; i < 3; i++) { a.select(item); a.mark(action); }
    assertMembership(a, item, action === 'know' ? 1 : 0, action === 'again' ? 1 : 0);
    assert.equal(Number(a.node('reviewCount').textContent), action === 'again' ? 1 : 0);
    assert.equal(a.state().done, 3, 'Historical attempts still accumulate');
    assert.equal(a.state().know, action === 'know' ? 3 : 0);
  });

  test(`${edition}: ${action} resolves a pre-existing overlap for the current item`, async () => {
    const a = await app(new Map([[keyFor(item), JSON.stringify({...blankState(), mastered: [item.id], review: [item.id]})]]));
    a.select(item);
    a.mark(action);
    assertMembership(a, item, action === 'know' ? 1 : 0, action === 'again' ? 1 : 0);
  });

  test(`${edition}: ${action} membership survives a fresh page startup`, async () => {
    const a = await app();
    a.select(item); a.mark('know');
    a.select(item); a.mark('again');
    a.select(item); a.mark(action);
    const saved = a.store.get(keyFor(item));
    const reloaded = await app(a.store);
    reloaded.select(item);
    assert.equal(reloaded.store.get(keyFor(item)), saved);
    assertMembership(reloaded, item, action === 'know' ? 1 : 0, action === 'again' ? 1 : 0);
    assert.equal(reloaded.node('memoryStatus').textContent, action === 'know' ? '已掌握' : '待加强');
  });
}

test(`${edition}: category counts, chapter progress and review filter update immediately`, async () => {
  const a = await app();
  a.select(item); a.mark('know');
  const total = data.filter(row => row.subject === item.subject && row.module === item.module && row.category === item.category).length;
  assert.equal(a.node('chapterProgress').attributes['aria-valuenow'], '1');
  assert.match(a.node('categoryList').innerHTML, new RegExp(`<span>1/${total}</span>`));
  a.select(item); a.mark('again');
  assert.equal(a.node('chapterProgress').attributes['aria-valuenow'], '0');
  assert.equal(a.node('chapterProgressFill').style.width, '0%');
  assert.equal(a.node('currentChapterRatio').textContent, `已掌握 0 / ${total}`);
  assert.equal(a.node('bandReviewCount').textContent, '待加强 1');
  assert.equal(a.json('categoryData()').find(row => row.category === item.category).done, 0);
  assert.match(a.node('categoryList').innerHTML, new RegExp(`<span>0/${total}</span>`));
  assert.equal(a.node('categoryList').innerHTML, a.node('mobileCategoryList').innerHTML);
  a.select(item, 'review');
  assert.deepEqual(a.json('filteredItems().map(item => item.id)'), [item.id]);
  assert.equal(a.node('memoryStatus').textContent, '待加强');
  a.mark('know');
  assert.deepEqual(a.json('filteredItems()'), []);
  assert.equal(a.run('current'), null);
  assert.equal(Number(a.node('totalCount').textContent), 0);
  assert.equal(Number(a.node('reviewCount').textContent), 0);
  assert.equal(a.node('knowBtn').disabled, true);
  assert.equal(a.node('againBtn').disabled, true);
  assertMembership(a, item, 1, 0);
});

test(`${edition}: marking preserves other records, favorites, custom answers and storage namespaces`, async () => {
  const other = data.find(row => row.subject === item.subject && row.module === item.module && row.id !== item.id);
  const initial = {...blankState(), done: 12, know: 7, mastered: [item.id, other.id], favorite: [item.id, other.id], extra: 'preserve'};
  const customKey = `${expected.prefix}:custom-answers`;
  const store = new Map([
    [keyFor(item), JSON.stringify(initial)],
    [keyFor(modules[1]), JSON.stringify({...blankState(), done: 8, review: [modules[1].id]})],
    [customKey, JSON.stringify({[item.id]: 'my answer', [other.id]: 'other answer'})],
    [`${expected.prefix}:preferences`, JSON.stringify({showCategoryHint: true})],
    ['herb-review-state', 'paid-progress-sentinel'],
    ['zhongyao-license-v3', 'paid-state-sentinel'],
    [`${expected.prefix === 'tcm-review-test:v1' ? 'tcm-review-trial:v1' : 'tcm-review-test:v1'}:sentinel`, 'other-edition'],
  ]);
  const before = new Map(store);
  const a = await app(store);
  a.select(item); a.mark('again');
  assert.deepEqual(a.state().mastered, [other.id]);
  assert.deepEqual(a.state().review, [item.id]);
  assert.equal(a.state().done, 13);
  assert.equal(a.state().know, 7);
  a.select(item); a.mark('know');
  assert.equal(a.state().done, 14);
  assert.equal(a.state().know, 8);
  assert.deepEqual(a.state().favorite, initial.favorite);
  assert.equal(a.state().extra, 'preserve');
  assert.equal(a.state().mastered.includes(other.id), true);
  for (const [key, value] of before) if (key !== keyFor(item)) assert.equal(store.get(key), value, key);
  assert.deepEqual([...new Set(a.writes)], [keyFor(item)]);
  assert.equal(store.size, before.size);
});

test(`${edition}: reverse review uses the same mutually exclusive marking rule`, async () => {
  const a = await app();
  a.node('modeSelect').value = 'reverse';
  a.select(item);
  assert.equal(a.node('promptName').textContent, item.reversePrompt);
  a.node('revealBtn').listeners.click();
  assert.equal(a.run('revealed'), true);
  a.mark('know');
  a.select(item); a.mark('again');
  assertMembership(a, item, 0, 1);
});

test(`${edition}: marking an empty review pool leaves state unchanged`, async () => {
  const a = await app();
  a.select(item, 'review');
  assert.equal(a.run('current'), null);
  a.mark('know'); a.mark('again');
  assert.deepEqual(a.state(), blankState());
  assert.equal(a.writes.length, 0);
});

// Phase 2: exercise the real favorite handler, including the stale-current
// boundary where the selected pool becomes empty before another pick occurs.
for (const item of modules) {
  for (const mode of ['forward', 'reverse']) {
    test(`${edition}: ${item.subject}/${item.module} ${mode} removing final favorite clears stale actions`, async () => {
      const initial = {...blankState(), done: 12, know: 7, mastered: [item.id], favorite: [item.id]};
      const customKey = `${expected.prefix}:custom-answers`;
      const custom = JSON.stringify({[item.id]: 'personal answer'});
      const a = await app(new Map([[keyFor(item), JSON.stringify(initial)], [customKey, custom]]));
      a.node('modeSelect').value = mode;
      a.select(item, 'favorite');
      a.node('revealBtn').listeners.click();
      a.node('favoriteBtn').listeners.click();
      assert.equal(a.run('current'), null);
      assert.equal(a.run('revealed'), false);
      assert.equal(a.node('promptName').textContent, '暂无题目');
      assert.match(a.node('answerBox').innerHTML, /当前范围暂无题目/);
      assert.deepEqual(a.json('filteredItems()'), []);
      assert.equal(Number(a.node('totalCount').textContent), 0);
      for (const id of ['revealBtn', 'knowBtn', 'againBtn', 'favoriteBtn', 'nextBtn', 'editAnswerBtn']) {
        assert.equal(a.node(id).disabled, true, id);
      }
      const saved = a.store.get(keyFor(item));
      a.mark('know'); a.mark('again');
      a.node('favoriteBtn').listeners.click();
      a.node('editAnswerBtn').listeners.click();
      a.node('nextBtn').listeners.click();
      assert.equal(a.run('current'), null);
      assert.equal(a.store.get(keyFor(item)), saved, 'No stale review may mutate progress');
      assert.deepEqual(a.state(), {...initial, favorite: []});
      assert.equal(a.store.get(customKey), custom);
      assert.equal(a.node('customModal').hidden, true);
      assert.equal(a.node('chapterProgress').attributes['aria-valuenow'], '1');
    });

    test(`${edition}: ${item.subject}/${item.module} ${mode} removal selects remaining favorite only`, async () => {
      const other = data.find(row => row.subject === item.subject && row.module === item.module && row.id !== item.id);
      const a = await app(new Map([[keyFor(item), JSON.stringify({...blankState(), favorite: [item.id, other.id]})]]));
      a.node('modeSelect').value = mode;
      a.select(item, 'favorite');
      a.run('activeCategory = "";');
      a.node('revealBtn').listeners.click();
      a.node('favoriteBtn').listeners.click();
      assert.equal(a.run('current.id'), other.id);
      assert.equal(a.run('revealed'), false);
      assert.deepEqual(a.json('filteredItems().map(row => row.id)'), [other.id]);
      assert.equal(Number(a.node('totalCount').textContent), 1);
      assert.equal(a.node('favoriteBtn').attributes['aria-pressed'], 'true');
      assert.equal(a.node('promptName').textContent, mode === 'forward' ? other.name : other.reversePrompt);
      a.mark('again');
      assert.deepEqual(a.state().review, [other.id], 'Marking must target the new current item');
    });
  }

  const otherCategory = data.find(row => row.subject === item.subject && row.module === item.module && row.category !== item.category);
  if (otherCategory) test(`${edition}: ${item.subject}/${item.module} favorites outside category do not prevent empty state`, async () => {
    const other = otherCategory;
    const a = await app(new Map([[keyFor(item), JSON.stringify({...blankState(), favorite: [item.id, other.id]})]]));
    a.select(item, 'favorite');
    a.node('favoriteBtn').listeners.click();
    assert.equal(a.run('current'), null);
    assert.deepEqual(a.state().favorite, [other.id]);
    assert.deepEqual(a.json('filteredItems()'), []);
  });

  test(`${edition}: ${item.subject}/${item.module} removed and re-added favorite survives reload`, async () => {
    const a = await app();
    a.select(item);
    a.node('favoriteBtn').listeners.click();
    a.select(item, 'favorite');
    a.node('favoriteBtn').listeners.click();
    const emptyReload = await app(a.store);
    emptyReload.select(item, 'favorite');
    assert.equal(emptyReload.run('current'), null);
    emptyReload.select(item, 'all');
    emptyReload.node('favoriteBtn').listeners.click();
    emptyReload.select(item, 'favorite');
    assert.equal(emptyReload.run('current.id'), item.id);
    const addedReload = await app(a.store);
    addedReload.select(item, 'favorite');
    assert.equal(addedReload.run('current.id'), item.id);
    assert.deepEqual(addedReload.state().favorite, [item.id]);
    assert.equal(addedReload.state().done, 0);
  });

  for (const pool of ['all', 'review']) {
    test(`${edition}: ${item.subject}/${item.module} toggling favorites in ${pool} retains current answer`, async () => {
      const a = await app(new Map([[keyFor(item), JSON.stringify({...blankState(), review: [item.id]})]]));
      a.select(item, pool);
      a.node('revealBtn').listeners.click();
      for (const favorite of [true, false]) {
        a.node('favoriteBtn').listeners.click();
        assert.equal(a.run('current.id'), item.id);
        assert.equal(a.run('revealed'), true);
        assert.equal(a.node('favoriteBtn').attributes['aria-pressed'], String(favorite));
      }
      assert.deepEqual(a.state().review, [item.id]);
      assert.equal(a.state().done, 0);
    });
  }
}
