import crypto from 'node:crypto';
import {nameClean,idClean,intClean,envClean,enoughGap,GAP_MESSAGE,bookingSubteam} from './validation.js';
import {httpError} from './http.js';
export const WINDOW_MESSAGES={closed:'BTC chưa mở đăng ký',not_yet:'Chưa đến giờ mở đăng ký',ended:'Đăng ký đã kết thúc'};
// Admin switch plus the optional auto-open/close window.
export function registrationWindow(settings, now=Date.now()) {
  if(!settings?.registration_open)return {open:false,reason:'closed'};
  if(settings.registration_opens_at && now<new Date(settings.registration_opens_at).getTime())return {open:false,reason:'not_yet'};
  if(settings.registration_closes_at && now>=new Date(settings.registration_closes_at).getTime())return {open:false,reason:'ended'};
  return {open:true,reason:'open'};
}
export async function createRegistration(tx, params, env, options={}) {
  env=envClean(env);
  const name=nameClean(params.student_name), sid=idClean(params.student_id);
  const slotId=intClean(params.slot_id), skipPast=options.skipPast===true;
  // Serialization by student protects cross-ban gap and unique committee during concurrent requests.
  await tx`SELECT pg_advisory_xact_lock(hashtext(${env+':'+sid}))`;
  const slots=await tx`
    SELECT s.id,s.env,s.committee_id,s.start_at,s.room,s.subteam AS slot_subteam,s.capacity,s.open,c.name AS committee_name,c.subteams
    FROM slots s JOIN committees c ON c.id=s.committee_id
    WHERE s.id=${slotId} AND s.env=${env} FOR UPDATE OF s`;
  if(!slots.length)throw httpError('Không tìm thấy phiên phỏng vấn',404);
  const slot=slots[0];
  if(!slot.open && !options.allowClosed)throw httpError('Phiên này đã đóng');
  if(!skipPast && new Date(slot.start_at).getTime()<=Date.now())throw httpError('Phiên đã qua, không thể đăng ký');
  // Imports from older lists may lack a subteam; they take the session's own subteam, if any.
  const subteam=options.allowNoSubteam && !params.subteam ? slot.slot_subteam||'' : bookingSubteam(slot.subteams,params.subteam,slot.slot_subteam);
  const old=await tx`
    SELECT r.committee_id,s.start_at FROM registrations r JOIN slots s ON s.id=r.slot_id
    WHERE r.env=${env} AND r.student_id=${sid}`;
  if(old.some(x=>x.committee_id===slot.committee_id))throw httpError('MSSV này đã đăng ký ban này');
  // Only this student's own bookings count, in whichever order they were made.
  if(old.some(x=>!enoughGap(x.start_at,slot.start_at)))throw Object.assign(httpError(GAP_MESSAGE),{gap:true});
  const [count]=await tx`SELECT COUNT(*)::int as total FROM registrations WHERE slot_id=${slotId}`;
  if(count.total>=slot.capacity)throw httpError('Phiên đã hết chỗ, vui lòng chọn phiên khác');
  const lookup=crypto.randomBytes(24).toString('base64url');
  const hash=crypto.createHash('sha256').update(lookup).digest('hex');
  const [result]=await tx`
    INSERT INTO registrations(env,committee_id,slot_id,student_name,student_id,lookup_hash,subteam)
    VALUES(${env},${slot.committee_id},${slotId},${name},${sid},${hash},${subteam})
    RETURNING id,created_at`;
  return {id:result.id, student_name:name, student_id:sid, committee_name:slot.committee_name, slot_id:slotId, start_at:slot.start_at, room:slot.room||'', subteam, environment:env, lookup_token:lookup};
}
