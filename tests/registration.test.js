import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegistration} from '../lib/registration.js';
import {GAP_MESSAGE} from '../lib/validation.js';

// Minimal in-memory stand-in for the postgres.js tagged-template tx, covering the queries createRegistration runs.
function fakeDb(slots) {
  const regs = [];
  const tx = async (strings, ...v) => {
    const q = strings.join('?');
    if (q.includes('pg_advisory_xact_lock')) return [];
    if (q.includes('FROM slots s JOIN committees')) return slots.filter(s => s.id === v[0] && s.env === v[1]).map(s => ({...s, slot_subteam: s.subteam || '', subteams: s.committee_id === 4 ? TEAMS : [], committee_name: 'Ban ' + s.committee_id}));
    if (q.includes('FROM registrations r JOIN slots s')) return regs.filter(r => r.env === v[0] && r.student_id === v[1]).map(r => ({committee_id: r.committee_id, start_at: slots.find(s => s.id === r.slot_id).start_at}));
    if (q.includes('COUNT(*)')) return [{total: regs.filter(r => r.slot_id === v[0]).length}];
    if (q.includes('INSERT INTO registrations')) { regs.push({id: regs.length + 1, env: v[0], committee_id: v[1], slot_id: v[2], student_id: v[4], subteam: v[6]}); return [{id: regs.length, created_at: new Date()}]; }
    throw new Error('unexpected query: ' + q);
  };
  return {tx, regs};
}
// Committee 4 has subteams, like Đại sứ Truyền thông.
const TEAMS = ['Creative Team', 'Product Team', 'Digital Team'];
const at = hhmm => `2030-10-27T${hhmm}:00+07:00`;
const slot = (id, committee_id, hhmm, capacity = 6) => ({id, env: 'test', committee_id, start_at: at(hhmm), capacity, open: true});
const book = (tx, sid, slot_id) => createRegistration(tx, {student_name: 'Sinh Viên', student_id: sid, slot_id}, 'test');
const SLOTS = [slot(1, 1, '14:00'), slot(2, 2, '14:15'), slot(3, 2, '14:30'), slot(4, 3, '13:45'), slot(5, 1, '14:30', 1)];

test('no break between sessions of different departments is rejected', async () => {
  const {tx} = fakeDb(SLOTS);
  await book(tx, 'SE170001', 1);                          // 14:00-14:15
  await assert.rejects(book(tx, 'SE170001', 2), {message: GAP_MESSAGE, gap: true});   // 14:15-14:30
});
test('15 minute break is allowed', async () => {
  const {tx, regs} = fakeDb(SLOTS);
  await book(tx, 'SE170001', 1);                          // 14:00-14:15
  await book(tx, 'SE170001', 3);                          // 14:30-14:45
  assert.equal(regs.length, 2);
});
test('rule holds when the later department is booked first', async () => {
  const {tx} = fakeDb(SLOTS);
  await book(tx, 'SE170001', 2);                          // 14:15 first
  await assert.rejects(book(tx, 'SE170001', 1), {message: GAP_MESSAGE});              // then 14:00
  await book(tx, 'SE170001', 4);                          // 13:45-14:00 then 14:15: 15 minute break, allowed
});
test('other students are not affected by the spacing rule', async () => {
  const {tx, regs} = fakeDb(SLOTS);
  await book(tx, 'SE170001', 1);                          // student A 14:00
  await book(tx, 'SE170002', 2);                          // student B 14:15, different department
  await book(tx, 'SE170003', 1);                          // student C same slot as A
  assert.equal(regs.length, 3);
});
test('capacity and duplicate department rules still apply', async () => {
  const {tx} = fakeDb(SLOTS);
  await book(tx, 'SE170001', 5);
  await assert.rejects(book(tx, 'SE170002', 5), /hết chỗ/);
  await assert.rejects(book(tx, 'SE170001', 1), /đã đăng ký ban này/);
});
test('subteam committees need exactly one valid subteam, stored with the booking', async () => {
  const slots = [slot(10, 4, '09:00'), {...slot(11, 4, '10:00'), subteam: 'Digital Team'}, {...slot(12, 4, '09:00'), subteam: 'Creative Team'}];
  const {tx, regs} = fakeDb(slots);
  const b = (sid, slot_id, subteam) => createRegistration(tx, {student_name: 'Sinh Viên', student_id: sid, slot_id, subteam}, 'test');
  await assert.rejects(b('SE170001', 10), /chọn một nhóm/);
  await assert.rejects(b('SE170001', 10, 'Marketing'), /Nhóm không hợp lệ/);
  await assert.rejects(b('SE170001', 11, 'Creative Team'), /chỉ dành cho Digital Team/);
  const r = await b('SE170001', 10, 'Product Team');           // shared session, any subteam
  assert.equal(r.subteam, 'Product Team');
  assert.equal(regs[0].subteam, 'Product Team');
  await b('SE170002', 12, 'Creative Team');                    // Creative session at the same time, other room
  assert.equal(regs.length, 2);
});
test('committees without subteams store no subteam', async () => {
  const {tx, regs} = fakeDb(SLOTS);
  await createRegistration(tx, {student_name: 'Sinh Viên', student_id: 'SE170001', slot_id: 1, subteam: 'Creative Team'}, 'test');
  assert.equal(regs[0].subteam, '');
});
