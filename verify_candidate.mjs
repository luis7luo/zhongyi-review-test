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
  assert.ok(gate.extra['主治'].includes('痣疯'), 'Unreviewed content-gate change');
  console.log(`${edition}: PASS ${rows.length} unique items; hashes, metadata, corrections intact. Content gate remains OPEN: 少泽/痣疯.`);
} catch (error) {
  console.error(`Candidate verification FAILED: ${error.message}`);
  process.exitCode = 1;
}
