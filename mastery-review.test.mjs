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
async function app(store = new Map()) {
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
      setItem(key, value) { writes.push(key); store.set(key, String(value)); },
    },
    window: {setTimeout: fn => fn(), matchMedia: () => ({matches: true})},
    fetch: async url => {
      assert.ok(['data/review_items.json', 'data/extraction_report.json'].includes(url));
      return {ok: true, json: async () => structuredClone(url.includes('review_items') ? data : report)};
    },
  });
  await script.runInContext(context);
  const run = source => vm.runInContext(source, context);
  const json = source => JSON.parse(run(`JSON.stringify(${source})`));
  return {
    node, store, writes, run, json,
    state: () => json('loadState()'),
    select(item, pool = 'all') {
      node('poolSelect').value = pool;
      run(`activeSubject = ${JSON.stringify(item.subject)}; activeModule = ${JSON.stringify(item.module)};
        activeCategory = ${JSON.stringify(item.category)}; pick(${JSON.stringify(item.id)});`);
    },
    mark(action) { node(action === 'know' ? 'knowBtn' : 'againBtn').listeners.click(); },
  };
}

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
