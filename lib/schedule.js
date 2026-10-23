import {SESSION_MINUTES} from './validation.js';
import {httpError} from './http.js';
import {registrationWindow,WINDOW_MESSAGES} from './registration.js';
// Automatic schedule planning. Pure functions so the rules can be unit tested without a database.
// All times are Vietnam local time (UTC+7, no daylight saving).
const MAX_DAYS = 31, MAX_SLOTS = 3000;
const DATE_RE = /^\d{4}-\d\d-\d\d$/;
const toMinutes = t => { const m = /^(\d\d):(\d\d)$/.exec(String(t ?? '')); if (!m) return null; const v = +m[1] * 60 + +m[2]; return +m[1] < 24 && +m[2] < 60 ? v : null; };
const hhmm = v => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
const vnDate = d => new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit'}).format(new Date(d)); // dd/mm
const vnTime = d => new Intl.DateTimeFormat('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date(d));
export const slotLabel = (start, committeeName) => `${committeeName ? committeeName + ' ' : ''}${vnTime(start)} ngày ${vnDate(start)}`;

// Returns {errors} when the configuration is unusable, otherwise {errors:[], slots:[{committee_id,start_at}], days, perDay}.
export function planSchedule(o) {
  const errors = [];
  const ids = Array.isArray(o.committee_ids) ? [...new Set(o.committee_ids.map(Number))] : [];
  if (!ids.length) errors.push('Chọn ít nhất một ban để tạo lịch.');
  else if (ids.some(x => !Number.isSafeInteger(x) || x < 1)) errors.push('Danh sách ban không hợp lệ.');
  const fromOk = DATE_RE.test(o.from_date ?? ''), toOk = DATE_RE.test(o.to_date ?? '');
  if (!fromOk) errors.push('Ngày bắt đầu không hợp lệ.');
  if (!toOk) errors.push('Ngày kết thúc không hợp lệ.');
  let days = 0;
  if (fromOk && toOk) {
    days = Math.round((Date.parse(o.to_date) - Date.parse(o.from_date)) / 86400000) + 1;
    if (days < 1) errors.push('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
    else if (days > MAX_DAYS) errors.push(`Mỗi lần chỉ tạo tối đa ${MAX_DAYS} ngày (đang chọn ${days} ngày).`);
  }
  const start = toMinutes(o.start_time), end = toMinutes(o.end_time);
  if (start === null) errors.push('Giờ bắt đầu không hợp lệ.');
  if (end === null) errors.push('Giờ kết thúc không hợp lệ.');
  if (start !== null && end !== null && end - start < SESSION_MINUTES) errors.push(`Giờ kết thúc (${hhmm(end)}) phải sau giờ bắt đầu (${hhmm(start)}) ít nhất ${SESSION_MINUTES} phút để có một ca.`);
  const hasBreakStart = !!o.break_start, hasBreakEnd = !!o.break_end;
  let bStart = null, bEnd = null;
  if (hasBreakStart !== hasBreakEnd) errors.push('Nhập đủ cả giờ bắt đầu và kết thúc nghỉ, hoặc để trống cả hai.');
  else if (hasBreakStart) {
    bStart = toMinutes(o.break_start); bEnd = toMinutes(o.break_end);
    if (bStart === null || bEnd === null) errors.push('Giờ nghỉ không hợp lệ.');
    else if (bEnd <= bStart) errors.push(`Giờ kết thúc nghỉ (${hhmm(bEnd)}) phải sau giờ bắt đầu nghỉ (${hhmm(bStart)}).`);
    else if (start !== null && end !== null && (bStart <= start || bEnd >= end)) errors.push(`Giờ nghỉ ${hhmm(bStart)}–${hhmm(bEnd)} phải nằm bên trong khung giờ ${hhmm(start)}–${hhmm(end)}.`);
  }
  const capacity = Number(o.capacity);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 200) errors.push('Số suất mỗi ca phải là số nguyên từ 1 đến 200.');
  if (errors.length) return {errors};

  const slots = [], times = [];
  for (let t = start; t + SESSION_MINUTES <= end; t += SESSION_MINUTES) {
    if (bStart !== null && t < bEnd && t + SESSION_MINUTES > bStart) continue; // session would overlap the break
    times.push(hhmm(t));
  }
  if (!times.length) return {errors: ['Khung giờ không đủ cho ca nào sau khi trừ giờ nghỉ.']};
  const first = Date.parse(o.from_date);
  for (let i = 0; i < days; i++) {
    const date = new Date(first + i * 86400000).toISOString().slice(0, 10);
    for (const t of times) for (const committee_id of ids) slots.push({committee_id, start_at: `${date}T${t}:00+07:00`});
  }
  if (slots.length > MAX_SLOTS) return {errors: [`Cấu hình này tạo ${slots.length} ca, vượt giới hạn ${MAX_SLOTS} ca mỗi lần. Hãy chia nhỏ khoảng ngày hoặc số ban.`]};
  return {errors: [], slots, days, perDay: times.length, capacity};
}

// Splits planned slots into ones to create and ones to skip. A planned slot is skipped when it is already
// over, when the same committee already has a slot at that exact time, or when it would overlap an
// existing slot of the same committee (starts less than one session apart).
export function sortOutConflicts(planned, existing, now = Date.now()) {
  const fresh = [], past = [], duplicates = [], overlaps = [];
  const byCommittee = new Map();
  for (const e of existing) { const k = Number(e.committee_id); if (!byCommittee.has(k)) byCommittee.set(k, []); byCommittee.get(k).push(new Date(e.start_at).getTime()); }
  for (const p of planned) {
    const t = Date.parse(p.start_at), same = byCommittee.get(p.committee_id) || [];
    if (t <= now) past.push(p);
    else if (same.some(x => x === t)) duplicates.push(p);
    else if (same.some(x => Math.abs(x - t) < SESSION_MINUTES * 60000)) overlaps.push({...p, with: same.find(x => Math.abs(x - t) < SESSION_MINUTES * 60000)});
    else fresh.push(p);
  }
  return {fresh, past, duplicates, overlaps};
}

// Creates the planned slots in one transaction and reports what was skipped and why, plus configuration
// problems that would stop students from seeing or booking the new slots. `sql` is a postgres.js client.
export async function generateSlots(sql, env, b, audit) {
  const plan = planSchedule(b);
  if (plan.errors.length) throw Object.assign(httpError('Cấu hình lịch chưa hợp lệ: ' + plan.errors[0]), {details: plan.errors});
  const ids = [...new Set(plan.slots.map(s => s.committee_id))];
  const found = await sql`SELECT id,name FROM committees WHERE id IN ${sql(ids)}`;
  const names = Object.fromEntries(found.map(c => [c.id, c.name])), missing = ids.filter(id => !names[id]);
  if (missing.length) throw httpError(`Không tìm thấy ban có mã ${missing.join(', ')}. Hãy tải lại trang quản trị rồi thử lại.`);
  const label = s => slotLabel(s.start_at, names[s.committee_id]);
  const result = await sql.begin(async tx => {
    const from = new Date(Date.parse(plan.slots[0].start_at) - SESSION_MINUTES * 60000), to = new Date(Date.parse(plan.slots.at(-1).start_at) + SESSION_MINUTES * 60000);
    const existing = await tx`SELECT committee_id,start_at FROM slots WHERE env=${env} AND committee_id IN ${tx(ids)} AND start_at>${from} AND start_at<${to}`;
    const r = sortOutConflicts(plan.slots, existing);
    const skipped = [
      r.duplicates.length && `${r.duplicates.length} ca đã có sẵn nên bỏ qua (ví dụ: ${r.duplicates.slice(0, 3).map(label).join('; ')}).`,
      r.overlaps.length && `${r.overlaps.length} ca chồng giờ với ca có sẵn của cùng ban nên bỏ qua (ví dụ: ${r.overlaps.slice(0, 3).map(s => `${label(s)} chồng với ca ${slotLabel(s.with)}`).join('; ')}). Sửa hoặc xóa ca cũ nếu muốn tạo lại.`,
      r.past.length && `${r.past.length} ca đã qua giờ nên không tạo.`].filter(Boolean);
    if (!r.fresh.length) throw Object.assign(httpError(`Không có ca mới nào được tạo trong ${plan.slots.length} ca dự kiến.`), {details: skipped});
    const rows = r.fresh.map(s => ({env, committee_id: s.committee_id, start_at: s.start_at, capacity: plan.capacity, open: true}));
    const inserted = await tx`INSERT INTO slots ${tx(rows, 'env', 'committee_id', 'start_at', 'capacity', 'open')} ON CONFLICT (env,committee_id,start_at) DO NOTHING RETURNING id`;
    await audit(tx, 'generate_slots', {env, committees: ids, from: b.from_date, to: b.to_date, start: b.start_time, end: b.end_time, break: [b.break_start || null, b.break_end || null], capacity: plan.capacity, created: inserted.length});
    return {created: inserted.length, planned: plan.slots.length, skipped};
  });
  const [settings] = await sql`SELECT active_env,registration_open,registration_opens_at,registration_closes_at FROM app_settings`;
  const envName = e => e === 'live' ? 'Chính thức' : 'Chạy thử', warnings = [];
  if (settings.active_env !== env) warnings.push(`Lịch vừa tạo thuộc môi trường ${envName(env)}, nhưng sinh viên đang thấy môi trường ${envName(settings.active_env)}. Đổi “Chế độ đang hiển thị cho sinh viên” ở mục Chế độ đăng ký để sinh viên thấy lịch này.`);
  else { const w = registrationWindow(settings); if (!w.open) warnings.push(`Sinh viên đã thấy lịch mới nhưng chưa đăng ký được: ${WINDOW_MESSAGES[w.reason]}. Kiểm tra mục Chế độ đăng ký.`); }
  return {...result, warnings};
}
