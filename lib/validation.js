export function nameClean(value) {
  const v = String(value ?? '').replace(/\s+/g,' ').trim();
  if (v.length < 2 || v.length > 100) throw new Error('Họ và tên phải từ 2 đến 100 ký tự');
  return v;
}
export function idClean(value) {
  const v = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{5,24}$/.test(v)) throw new Error('MSSV không hợp lệ (5-24 ký tự A-Z, 0-9 hoặc dấu -)');
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
