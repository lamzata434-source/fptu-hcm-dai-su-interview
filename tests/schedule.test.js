import test from 'node:test';
import assert from 'node:assert/strict';
import {planSchedule, sortOutConflicts, generateSlots} from '../lib/schedule.js';

const base = {committee_ids: [1, 2], from_date: '2030-10-27', to_date: '2030-10-28', start_time: '08:00', end_time: '09:00', capacity: 1};

test('plans 15 minute sessions per committee per day', () => {
  const p = planSchedule(base);
  assert.deepEqual(p.errors, []);
  assert.equal(p.perDay, 4);                       // 08:00 08:15 08:30 08:45
  assert.equal(p.slots.length, 4 * 2 * 2);         // 4 times x 2 committees x 2 days
  assert.equal(p.slots[0].start_at, '2030-10-27T08:00:00+07:00');
  assert.ok(p.slots.every(s => !s.start_at.includes('T09:00')));   // 09:00 would end after 09:00
});
test('lunch break removes overlapping sessions', () => {
  const p = planSchedule({...base, committee_ids: [1], to_date: '2030-10-27', end_time: '14:00', break_start: '11:40', break_end: '13:30'});
  const times = p.slots.map(s => s.start_at.slice(11, 16));
  assert.ok(times.includes('11:15'));              // ends 11:30, before the break
  assert.ok(!times.includes('11:30'));             // 11:30-11:45 overlaps 11:40
  assert.ok(!times.includes('13:15'));
  assert.ok(times.includes('13:30'));
});
test('configuration errors are specific', () => {
  const e = cfg => planSchedule({...base, ...cfg}).errors.join(' | ');
  assert.match(e({committee_ids: []}), /ít nhất một ban/);
  assert.match(e({to_date: '2030-10-26'}), /Ngày kết thúc phải bằng hoặc sau/);
  assert.match(e({to_date: '2030-12-30'}), /tối đa 31 ngày/);
  assert.match(e({end_time: '08:10'}), /ít nhất 15 phút/);
  assert.match(e({start_time: '8h'}), /Giờ bắt đầu không hợp lệ/);
  assert.match(e({break_start: '08:30'}), /Nhập đủ cả giờ bắt đầu và kết thúc nghỉ/);
  assert.match(e({break_start: '08:30', break_end: '08:15'}), /phải sau giờ bắt đầu nghỉ/);
  assert.match(e({break_start: '07:30', break_end: '08:30'}), /phải nằm bên trong khung giờ/);
  assert.match(e({capacity: 0}), /Số suất/);
});
test('conflicts with existing slots are sorted out', () => {
  const p = planSchedule({...base, committee_ids: [1], to_date: '2030-10-27'});
  const existing = [
    {committee_id: 1, start_at: '2030-10-27T08:00:00+07:00'},   // exact duplicate
    {committee_id: 1, start_at: '2030-10-27T08:20:00+07:00'},   // overlaps 08:15 and 08:30
    {committee_id: 2, start_at: '2030-10-27T08:45:00+07:00'},   // other committee: no conflict
  ];
  const r = sortOutConflicts(p.slots, existing, Date.parse('2030-01-01'));
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.overlaps.length, 2);
  assert.deepEqual(r.fresh.map(s => s.start_at.slice(11, 16)), ['08:45']);
});
test('past sessions are skipped', () => {
  const p = planSchedule({...base, committee_ids: [1], to_date: '2030-10-27'});
  const r = sortOutConflicts(p.slots, [], Date.parse('2030-10-27T08:20:00+07:00'));
  assert.equal(r.past.length, 2);
  assert.equal(r.fresh.length, 2);
});

// Minimal stand-in for the postgres.js client: tagged queries, sql(list) helpers and sql.begin.
function fakeSql({committees, slots = [], settings}) {
  const inserted = [];
  const sql = (first, ...v) => {
    if (!Array.isArray(first) || !first.raw) return {helper: first, cols: v};      // sql(ids) / sql(rows,...cols)
    const q = first.join('?');
    if (q.includes('FROM committees')) return Promise.resolve(committees.filter(c => v[0].helper.includes(c.id)));
    if (q.includes('FROM slots')) return Promise.resolve(slots.filter(s => s.env === v[0] && v[1].helper.includes(s.committee_id)));
    if (q.includes('INSERT INTO slots')) { const rows = v[0].helper.filter(r => !slots.some(s => s.env === r.env && s.committee_id === r.committee_id && Date.parse(s.start_at) === Date.parse(r.start_at))); inserted.push(...rows); return Promise.resolve(rows.map((_, i) => ({id: i + 1}))); }
    if (q.includes('FROM app_settings')) return Promise.resolve([settings]);
    throw new Error('unexpected query ' + q);
  };
  sql.begin = fn => fn(sql);
  return {sql, inserted};
}
const committees = [{id: 1, name: 'CLB Đại sứ sinh viên'}, {id: 2, name: 'Đại sứ về Trường'}];
const openSettings = {active_env: 'test', registration_open: true};
const noAudit = async () => {};
const body = {committee_ids: [1, 2], from_date: '2030-10-27', to_date: '2030-10-27', start_time: '10:30', end_time: '11:30', capacity: 1};

test('generateSlots creates every planned session', async () => {
  const {sql, inserted} = fakeSql({committees, settings: openSettings});
  const r = await generateSlots(sql, 'test', body, noAudit);
  assert.equal(r.created, 8);
  assert.equal(inserted.length, 8);
  assert.ok(inserted.every(x => x.env === 'test' && x.capacity === 1 && x.open === true));
  assert.deepEqual(r.warnings, []);
});
test('generateSlots reports duplicates and overlaps by name and time', async () => {
  const slots = [{env: 'test', committee_id: 1, start_at: '2030-10-27T10:30:00+07:00'}, {env: 'test', committee_id: 2, start_at: '2030-10-27T10:50:00+07:00'}];
  const {sql} = fakeSql({committees, slots, settings: openSettings});
  const r = await generateSlots(sql, 'test', body, noAudit);
  assert.equal(r.created, 5);
  assert.match(r.skipped[0], /1 phiên đã có sẵn.*CLB Đại sứ sinh viên 10:30 ngày 27\/10/);
  assert.match(r.skipped[1], /2 phiên chồng giờ.*Đại sứ về Trường 10:45 ngày 27\/10 chồng với phiên 10:50/);
});
test('generateSlots fails with details when nothing new can be created', async () => {
  const slots = ['10:30', '10:45', '11:00', '11:15'].flatMap(t => [1, 2].map(c => ({env: 'test', committee_id: c, start_at: `2030-10-27T${t}:00+07:00`})));
  const {sql} = fakeSql({committees, slots, settings: openSettings});
  await assert.rejects(generateSlots(sql, 'test', body, noAudit), e => /Không có phiên mới nào/.test(e.message) && /8 phiên đã có sẵn/.test(e.details[0]));
});
test('generateSlots rejects bad configuration and unknown committees', async () => {
  const {sql} = fakeSql({committees, settings: openSettings});
  await assert.rejects(generateSlots(sql, 'test', {...body, end_time: '10:00'}, noAudit), e => e.status === 400 && e.details.some(d => /ít nhất 15 phút/.test(d)));
  await assert.rejects(generateSlots(sql, 'test', {...body, committee_ids: [9]}, noAudit), /Không tìm thấy ban có mã 9/);
});
test('generateSlots warns when students will not see or cannot book the slots', async () => {
  let {sql} = fakeSql({committees, settings: {active_env: 'live', registration_open: true}});
  assert.match((await generateSlots(sql, 'test', body, noAudit)).warnings[0], /sinh viên đang thấy môi trường Chính thức/);
  ({sql} = fakeSql({committees, settings: {active_env: 'test', registration_open: false}}));
  assert.match((await generateSlots(sql, 'test', body, noAudit)).warnings[0], /chưa đăng ký được: BTC chưa mở đăng ký/);
});
test('subteams of one committee are separate tracks', () => {
  const p = planSchedule({committee_ids: [3], from_date: '2030-10-27', to_date: '2030-10-27', start_time: '09:00', end_time: '09:30', capacity: 1}).slots.map(s => ({...s, subteam: 'Product Team'}));
  const existing = [{committee_id: 3, subteam: 'Creative Team', start_at: '2030-10-27T09:00:00+07:00'}, {committee_id: 3, subteam: 'Product Team', start_at: '2030-10-27T09:15:00+07:00'}];
  const r = sortOutConflicts(p, existing, Date.parse('2030-01-01'));
  assert.deepEqual(r.fresh.map(s => s.start_at), ['2030-10-27T09:00:00+07:00']);   // Creative at 09:00 does not block Product
  assert.equal(r.duplicates.length, 1);
});
test('generateSlots sets room and subteam on every session', async () => {
  const teams = [...committees, {id: 3, name: 'Đại sứ Truyền thông', subteams: ['Creative Team', 'Product Team', 'Digital Team']}];
  const {sql, inserted} = fakeSql({committees: teams, settings: openSettings});
  const r = await generateSlots(sql, 'test', {...body, committee_ids: [3], room: ' C.301 ', subteam: 'Creative Team'}, noAudit);
  assert.equal(r.created, 4);
  assert.ok(inserted.every(x => x.room === 'C.301' && x.subteam === 'Creative Team'));
  await assert.rejects(generateSlots(sql, 'test', {...body, committee_ids: [1, 3], subteam: 'Creative Team'}, noAudit), e => /không thuộc CLB Đại sứ sinh viên/.test(e.message));
  await assert.rejects(generateSlots(sql, 'test', {...body, room: 'x'.repeat(51)}, noAudit), e => e.details.some(d => /Số phòng/.test(d)));
});
