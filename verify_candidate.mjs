import assert from 'node:assert/strict';
import {readFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only: a changed artifact requires review, not automatic hash acceptance.
const root = dirname(fileURLToPath(import.meta.url));
const target = realpathSync(resolve(process.argv[2] || root));
const edition = target === root ? 'full' : 'trial';
const read = (base, path) => JSON.parse(readFileSync(resolve(base, path), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedFull = {'中药':374,'方剂':277,'针灸-穴位':99,'针灸-病证选穴':64,'合计':814};
const expectedTrial = {'中药':37,'方剂':37,'针灸-穴位':20,'针灸-病证选穴':17,'合计':111};
const counts = rows => ({
  '中药': rows.filter(x => x.subject === '中药').length,
  '方剂': rows.filter(x => x.subject === '方剂').length,
  '针灸-穴位': rows.filter(x => x.subject === '针灸' && x.module === '穴位').length,
  '针灸-病证选穴': rows.filter(x => x.subject === '针灸' && x.module === '病证选穴').length,
  '合计': rows.length,
});
try {
  const manifest = read(root, 'candidate-manifest.json');
  const candidate = manifest[edition];
  for (const [path, hash] of Object.entries(candidate.files)) {
    assert.equal(digest(readFileSync(resolve(target, path))), hash, `Artifact drift: ${path}`);
  }
  const rows = read(target, 'data/review_items.json');
  assert.deepEqual(counts(rows), edition === 'full' ? expectedFull : expectedTrial);
  assert.equal(new Set(rows.map(x => x.id)).size, rows.length, 'Duplicate IDs');
  const report = read(target, 'data/extraction_report.json');
  assert.deepEqual(report.counts, counts(rows), 'Report/data mismatch');
  if (edition === 'trial') assert.deepEqual(report.fullCounts, expectedFull);
  const html = readFileSync(resolve(target, 'index.html'), 'utf8');
  assert.match(html.match(/class="edition-badge">([^<]+)</)[1], new RegExp(`\\b${rows.length} 题`));
  const full = read(root, 'data/review_items.json');
  assert.deepEqual(counts(full), expectedFull);
  const fullIds = new Set(full.map(x => x.id));
  assert.ok(rows.every(x => fullIds.has(x.id)), 'Unknown trial ID');
  const rules = read(root, 'docs/evidence/tcm_corrections.json');
  assert.equal(Object.keys(rules.herbs).length, 7);
  for (const [name, correction] of Object.entries(rules.herbs)) {
    const matches = full.filter(x => x.subject === '中药' && x.name === name);
    assert.equal(matches.length, 1, name);
    assert.equal(matches[0].primaryAnswer, correction.formalEffect, name);
    assert.equal(matches[0].reversePrompt, correction.formalEffect, name);
  }
  assert.ok(!full.some(x => x.name === '滚痰丸'));
  for (const name of rules.mergeAcupunctureTreatments) assert.equal(full.filter(x => x.module === '病证选穴' && x.name === name).length, 1, name);
  for (const name of rules.preserveAcupunctureAlternatives) assert.equal(full.filter(x => x.module === '病证选穴' && x.name === name).length, 2, name);
  const gate = full.find(x => x.id === 'zhenjiu-point-044-少泽');
  const indications = '1.肩臂后侧痛，小指麻木疼痛2.乳疾：乳痈、乳少、产后缺乳3.急症、热证：昏迷、中风、癫狂、热病4.头面五官病：头痛、目翳、咽喉肿痛、耳聋耳鸣';
  assert.equal(gate.extra['主治'], indications, 'Shaoze approved omission changed');
  assert.equal(gate.primaryAnswer, `定位：${gate.extra['定位']}\n主治：${indications}`, 'Shaoze mirrored answer mismatch');
  assert.ok(!JSON.stringify(full).includes('痣疯'), 'Shaoze suspicious term reintroduced');
  assert.equal(manifest.contentGate, 'CLOSED by approved omission: 2026-10-03 Shaoze disposition');
  console.log(`${edition}: PASS ${rows.length} unique items; hashes, metadata, corrections intact. Shaoze gate closed by approved omission.`);
} catch (error) {
  console.error(`Candidate verification FAILED: ${error.message}`);
  process.exitCode = 1;
}
