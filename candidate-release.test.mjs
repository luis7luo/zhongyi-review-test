import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
// Mutate only disposable copies, never candidate artifacts or user state.
function check(mutate, edition = 'full') {
  const temp = mkdtempSync(resolve(tmpdir(), 'tcm-candidate-check-'));
  try {
    const dirs = {full: resolve(temp, 'zhongyi-review-test'), trial: resolve(temp, 'zhongyi-review-trial')};
    const manifest = JSON.parse(readFileSync(resolve(root, 'candidate-manifest.json')));
    for (const e of ['full','trial']) for (const path of Object.keys(manifest[e].files)) {
      const dest = resolve(dirs[e], path);
      mkdirSync(dirname(dest), {recursive: true});
      copyFileSync(resolve(e === 'full' ? root : resolve(root, '../zhongyi-review-trial'), path), dest);
    }
    copyFileSync(resolve(root, 'verify_candidate.mjs'), resolve(dirs.full, 'verify_candidate.mjs'));
    const write = (path, content, rehash = false) => {
      writeFileSync(resolve(dirs[edition], path), content);
      if (rehash) manifest[edition].files[path] = createHash('sha256').update(content).digest('hex');
    };
    const read = path => readFileSync(resolve(dirs[edition], path), 'utf8');
    mutate?.({read, write});
    writeFileSync(resolve(dirs.full, 'candidate-manifest.json'), JSON.stringify(manifest));
    return spawnSync(process.execPath, [resolve(dirs.full, 'verify_candidate.mjs'), dirs[edition]], {encoding:'utf8'});
  } finally { rmSync(temp, {recursive: true, force: true}); }
}

for (const edition of ['full','trial']) test(`frozen ${edition} verifies independently from checkpoint-shaped copies`, () => {
  const result = check(null, edition);
  assert.equal(result.status, 0, result.stderr);
});

test('HTML artifact drift fails closed', () => {
  const result = check(({read,write}) => write('index.html',read('index.html')+'\n'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Artifact drift/);
});

test('report/data mismatch fails even if its checksum was updated', () => {
  const result = check(({read,write}) => {
    const report=JSON.parse(read('data/extraction_report.json'));report.counts['合计']=826;
    write('data/extraction_report.json',JSON.stringify(report),true);
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Report\/data mismatch/);
});

test('duplicate IDs fail even with an updated data checksum', () => {
  const result = check(({read,write}) => {
    const rows=JSON.parse(read('data/review_items.json'));rows[1].id=rows[0].id;
    write('data/review_items.json',JSON.stringify(rows),true);
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Duplicate IDs/);
});

test('approved herb answer invariant survives a checksum update', () => {
  const result=check(({read,write}) => {
    const rows=JSON.parse(read('data/review_items.json'));rows.find(x=>x.name==='荆芥').primaryAnswer='test-only corruption';
    write('data/review_items.json',JSON.stringify(rows),true);
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/荆芥/);
});

test('trial stale edition badge fails even with an updated HTML checksum', () => {
  const result=check(({read,write}) => write('index.html',read('index.html').replace('免费体验版 · 111 题','免费体验版 · 112 题'),true),'trial');
  assert.notEqual(result.status,0);
});

test('Shaoze suspicious indication cannot return even with an updated data checksum', () => {
  const result = check(({read, write}) => write('data/review_items.json',
    read('data/review_items.json').replaceAll('昏迷、中风、癫狂、热病', '昏迷、中风、癫狂、痣疯、热病'), true));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Shaoze/);
});
