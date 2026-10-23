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
export function enoughGap(a,b) { return Math.abs(new Date(a).getTime()-new Date(b).getTime()) >= 15*60*1000; }
export function csvSafe(v) { const s=String(v??''); return /^[\s]*[=+@\-\t\r]/.test(s) ? "'"+s : s; }
export function csvCell(v){ return '"'+csvSafe(v).replace(/"/g,'""')+'"'; }
// A submission must name 1-10 distinct slots; an empty one would lock the MSSV with nothing booked.
export function slotIdsClean(body) {
  const raw = Array.isArray(body?.slot_ids) ? body.slot_ids : body?.slot_id == null ? [] : [body.slot_id];
  if (!raw.length) throw new Error('Vui lòng chọn ít nhất một ca phỏng vấn trước khi đăng ký');
  const ids = [...new Set(raw.map(x => intClean(x)))];
  if (ids.length > 10) throw new Error('Chọn tối đa 10 ca');
  return ids;
}
