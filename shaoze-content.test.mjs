import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const text = readFileSync(new URL('./data/review_items.json', import.meta.url), 'utf8');
const rows = JSON.parse(text);
const item = rows.find(x => x.id === 'zhenjiu-point-044-少泽');
const indications = '1.肩臂后侧痛，小指麻木疼痛2.乳疾：乳痈、乳少、产后缺乳3.急症、热证：昏迷、中风、癫狂、热病4.头面五官病：头痛、目翳、咽喉肿痛、耳聋耳鸣';

test('Shaoze removes only the approved suspicious indication and mirrors the answer', () => {
  assert.equal(item.extra.主治, indications);
  assert.equal(item.primaryAnswer, `定位：${item.extra.定位}\n主治：${indications}`);
  assert.ok(!text.includes('痣疯'), 'Suspicious source term must not re-enter current question data');
});

test('all data bytes, IDs and other indications match Phase 5 except the two approved omissions', () => {
  assert.equal(text.split('昏迷、中风、癫狂、热病').length - 1, 2);
  const historical = text.replaceAll('昏迷、中风、癫狂、热病', '昏迷、中风、癫狂、痣疯、热病');
  assert.equal(createHash('sha256').update(historical).digest('hex'),
    'c259229cf535deef22db4676a02150b6f68379ec2b2ff6b09e1a0d732dde9ac3');
});
