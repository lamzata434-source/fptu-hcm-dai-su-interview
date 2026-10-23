import {db} from '../lib/db.js';
import {createRegistration,registrationWindow,WINDOW_MESSAGES} from '../lib/registration.js';
import {fail,method,jsonBody,noCache,sameOrigin,httpError} from '../lib/http.js';
import {idClean,slotIdsClean} from '../lib/validation.js';
const slotLabel=d=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',hour12:false}).format(new Date(d));
export default async function handler(req,res){
  noCache(res);
  try{
    method(req,'POST');sameOrigin(req);const body=jsonBody(req);const sql=db();
    const slotIds=slotIdsClean(body);
    const sid=idClean(body.student_id);
    const result=await sql.begin(async tx=>{
      const [settings]=await tx`SELECT active_env,registration_open,registration_opens_at,registration_closes_at FROM app_settings WHERE singleton=true FOR SHARE`;
      const w=registrationWindow(settings);
      if(!w.open)throw httpError(WINDOW_MESSAGES[w.reason]);
      const env=settings.active_env;
      // One submission per MSSV. Same advisory key as createRegistration, so concurrent submits serialize.
      await tx`SELECT pg_advisory_xact_lock(hashtext(${env+':'+sid}))`;
      const [locked]=await tx`SELECT 1 FROM registration_locks WHERE env=${env} AND student_id=${sid}`;
      if(locked)throw httpError('MSSV này đã gửi đăng ký. Sinh viên không thể tự đăng ký lại, sửa hoặc hủy; vui lòng liên hệ Admin để được mở khóa.',409);
      const chosen=await tx`
        SELECT s.id,s.committee_id,s.start_at,c.name FROM slots s JOIN committees c ON c.id=s.committee_id
        WHERE s.env=${env} AND s.id IN ${tx(slotIds)} ORDER BY s.start_at`;
      if(chosen.length!==slotIds.length)throw httpError('Không tìm thấy ca phỏng vấn',404);
      if(new Set(chosen.map(s=>s.committee_id)).size!==chosen.length)throw httpError('Mỗi ban chỉ được chọn một ca');
      const registrations=[];
      for(const s of chosen){
        // All-or-nothing: any failing slot rolls back the whole submission.
        try{registrations.push(await createRegistration(tx,{...body,student_id:sid,slot_id:s.id},env));}
        catch(e){e.message=`${s.name} (${slotLabel(s.start_at)}): ${e.message}`;throw e;}
      }
      await tx`INSERT INTO registration_locks(env,student_id) VALUES(${env},${sid})`;
      return registrations;
    });
    res.status(201).json({ok:true,registrations:result});
  }catch(e){console.error('register',e);fail(res,e);}
}
