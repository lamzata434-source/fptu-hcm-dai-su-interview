import crypto from 'node:crypto';
import {nameClean,idClean,intClean,envClean} from './validation.js';
import {httpError} from './http.js';
export async function createRegistration(tx, params, env, options={}) {
  env=envClean(env);
  const name=nameClean(params.student_name), sid=idClean(params.student_id);
  const slotId=intClean(params.slot_id), skipPast=options.skipPast===true;
  // Serialization by student protects cross-ban gap and unique committee during concurrent requests.
  await tx`SELECT pg_advisory_xact_lock(hashtext(${env+':'+sid}))`;
  const slots=await tx`
    SELECT s.id,s.env,s.committee_id,s.start_at,s.room,s.capacity,s.open,c.name AS committee_name
    FROM slots s JOIN committees c ON c.id=s.committee_id
    WHERE s.id=${slotId} AND s.env=${env} FOR UPDATE OF s`;
  if(!slots.length)throw httpError('Không tìm thấy ca phỏng vấn',404);
  const slot=slots[0];
  if(!slot.open && !options.allowClosed)throw httpError('Ca này đã đóng');
  if(!skipPast && new Date(slot.start_at).getTime()<=Date.now())throw httpError('Ca đã qua, không thể đăng ký');
  const old=await tx`
    SELECT r.committee_id,s.start_at FROM registrations r JOIN slots s ON s.id=r.slot_id
    WHERE r.env=${env} AND r.student_id=${sid}`;
  if(old.some(x=>x.committee_id===slot.committee_id))throw httpError('MSSV này đã đăng ký ban này');
  if(old.some(x=>Math.abs(new Date(x.start_at)-new Date(slot.start_at))<15*60*1000))throw httpError('Ca mới cách ca đã đăng ký dưới 15 phút');
  const [count]=await tx`SELECT COUNT(*)::int as total FROM registrations WHERE slot_id=${slotId}`;
  if(count.total>=slot.capacity)throw httpError('Ca đã hết chỗ, vui lòng chọn ca khác');
  const lookup=crypto.randomBytes(24).toString('base64url');
  const hash=crypto.createHash('sha256').update(lookup).digest('hex');
  const [result]=await tx`
    INSERT INTO registrations(env,committee_id,slot_id,student_name,student_id,lookup_hash)
    VALUES(${env},${slot.committee_id},${slotId},${name},${sid},${hash})
    RETURNING id,created_at`;
  return {id:result.id, student_name:name, student_id:sid, committee_name:slot.committee_name, slot_id:slotId, start_at:slot.start_at, room:slot.room, environment:env, lookup_token:lookup};
}
