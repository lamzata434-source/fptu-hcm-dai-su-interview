export function nameClean(value) {
  const v = String(value ?? '').replace(/\s+/g,' ').trim();
  if (v.length < 2 || v.length > 100) throw new Error('Họ và tên phải từ 2 đến 100 ký tự');
  return v;
}
// FPTU MSSV: two letters followed by six digits, e.g. SE170001.
export const MSSV_RE = /^[A-Z]{2}\d{6}$/;
export function idClean(value) {
  const v = String(value ?? '').trim().toUpperCase();
  if (!MSSV_RE.test(v)) throw new Error('MSSV không hợp lệ: gồm 2 chữ cái in hoa và 6 chữ số, ví dụ SE170001');
  return v;
}
export function envClean(value) {
  if (value !== 'test' && value !== 'live') throw new Error('Môi trường không hợp lệ');
  return value;
}
// Interview room shown to students, e.g. "A.203". '' means the room is not assigned yet.
export function roomClean(value) {
  const v = String(value ?? '').replace(/\s+/g,' ').trim();
  if (v.length > 50) throw new Error('Số phòng tối đa 50 ký tự');
  return v;
}
// A committee's subteams, e.g. Creative Team, Product Team, Digital Team. Accepts an array or a comma list.
export function subteamListClean(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const list = [...new Set(raw.map(x => String(x ?? '').replace(/\s+/g,' ').trim()).filter(Boolean))];
  if (list.length > 10 || list.some(x => x.length > 50)) throw new Error('Tối đa 10 nhóm, mỗi tên nhóm tối đa 50 ký tự');
  return list;
}
// The subteam of one booking: exactly one of the committee's subteams when it has any, otherwise ''.
// A session reserved for one subteam only takes that subteam.
export function bookingSubteam(subteams, value, slotSubteam = '') {
  if (!subteams?.length) return '';
  const v = String(value ?? '').trim();
  if (!v) throw new Error(`Vui lòng chọn một nhóm: ${subteams.join(', ')}`);
  if (!subteams.includes(v)) throw new Error(`Nhóm không hợp lệ. Hãy chọn một trong: ${subteams.join(', ')}`);
  if (slotSubteam && slotSubteam !== v) throw new Error(`Phiên này chỉ dành cho ${slotSubteam}`);
  return v;
}
export function intClean(value, min=1, max=2147483647) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('Giá trị số không hợp lệ');
  return n;
}
export function startClean(value) {
  if (typeof value !== 'string' || !/\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value) || !/(Z|[+-]\d\d:\d\d)$/.test(value)) {
    throw new Error('Giờ phải ở dạng ISO với múi giờ, ví dụ 2026-10-27T08:00:00+07:00');
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Ngày giờ không hợp lệ');
  return d.toISOString();
}
// Sessions last 15 minutes and a student needs a 15-minute break between two of them, so start
// times must be at least 30 minutes apart: 14:00 + 14:30 is fine, 14:00 + 14:15 is not.
export const SESSION_MINUTES = 15, BREAK_MINUTES = 15;
export const MIN_START_GAP_MS = (SESSION_MINUTES + BREAK_MINUTES) * 60 * 1000;
export const GAP_MESSAGE = 'Hai phiên phỏng vấn phải cách nhau ít nhất 15 phút. Vui lòng chọn phiên khác.';
export function enoughGap(a,b) { return Math.abs(new Date(a).getTime()-new Date(b).getTime()) >= MIN_START_GAP_MS; }
export function csvSafe(v) { const s=String(v??''); return /^[\s]*[=+@\-\t\r]/.test(s) ? "'"+s : s; }
export function csvCell(v){ return '"'+csvSafe(v).replace(/"/g,'""')+'"'; }
// A submission must name 1-10 distinct slots; an empty one would lock the MSSV with nothing booked.
export function slotIdsClean(body) {
  const raw = Array.isArray(body?.slot_ids) ? body.slot_ids : body?.slot_id == null ? [] : [body.slot_id];
  if (!raw.length) throw new Error('Vui lòng chọn ít nhất một phiên phỏng vấn trước khi đăng ký');
  const ids = [...new Set(raw.map(x => intClean(x)))];
  if (ids.length > 10) throw new Error('Chọn tối đa 10 phiên');
  return ids;
}
