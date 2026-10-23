import {db} from '../lib/db.js';
import {fail,method,noCache,requireAdmin,jsonBody,sameOrigin,httpError} from '../lib/http.js';
import {envClean,intClean,startClean,nameClean,idClean,enoughGap,MIN_START_GAP_MS,GAP_MESSAGE} from '../lib/validation.js';
import {generateSlots} from '../lib/schedule.js';
const uniqueSlot=e=>{if(e?.code==='23505')throw httpError('Ban này đã có ca vào giờ đó');throw e;};
async function audit(tx,action,details){await tx`INSERT INTO admin_audit(action,details) VALUES(${action},${JSON.stringify(details)}::jsonb)`;}
export default async function handler(req,res){
  noCache(res);
  try{
    requireAdmin(req);const sql=db();
    if(req.method==='GET'){
      const env=envClean(String(req.query?.env||'test'));
      const [settings]=await sql`SELECT active_env,registration_open,registration_opens_at,registration_closes_at,notice FROM app_settings`;
      const committees=await sql`SELECT id,name FROM committees ORDER BY id`;
      const slots=await sql`
        SELECT s.id,s.env,s.committee_id,s.start_at,s.capacity,s.open,COUNT(r.id)::int AS registered
        FROM slots s LEFT JOIN registrations r ON r.slot_id=s.id
        WHERE s.env=${env} GROUP BY s.id ORDER BY s.start_at,s.committee_id`;
      const registrations=await sql`
        SELECT r.id,r.student_name,r.student_id,r.created_at,r.slot_id,
          c.name AS committee_name,s.start_at,s.committee_id
        FROM registrations r JOIN slots s ON s.id=r.slot_id
        JOIN committees c ON c.id=r.committee_id
        WHERE r.env=${env} ORDER BY s.start_at,r.created_at`;
      const locks=await sql`
        SELECT l.student_id,l.created_at,
          (SELECT r.student_name FROM registrations r WHERE r.env=l.env AND r.student_id=l.student_id ORDER BY r.created_at DESC LIMIT 1) AS student_name,
          (SELECT COUNT(*)::int FROM registrations r WHERE r.env=l.env AND r.student_id=l.student_id) AS registered
        FROM registration_locks l WHERE l.env=${env} ORDER BY l.created_at DESC`;
      return res.status(200).json({settings,committees,slots,registrations,locks});
    }
    method(req,'POST');sameOrigin(req);const b=jsonBody(req);
    const action=String(b.action||'');
    if(action==='settings'){
      const active_env=envClean(b.active_env);
      const registration_open=b.registration_open===true;
      const notice=String(b.notice||'').trim().slice(0,500);
      if(!notice)throw httpError('Thông báo không được để trống');
      const opens=b.registration_opens_at?startClean(b.registration_opens_at):null, closes=b.registration_closes_at?startClean(b.registration_closes_at):null;
      if(opens&&closes&&opens>=closes)throw httpError('Giờ đóng đăng ký phải sau giờ mở');
      await sql.begin(async tx=>{
        await tx`UPDATE app_settings SET active_env=${active_env},registration_open=${registration_open},notice=${notice},
          registration_opens_at=${opens},registration_closes_at=${closes}`;
        await audit(tx,'settings',{active_env,registration_open,opens,closes});
      });
    }else if(action==='rename_committee'){
      const id=intClean(b.committee_id,1,1000), name=nameClean(b.name);
      await sql.begin(async tx=>{
        const r=await tx`UPDATE committees SET name=${name} WHERE id=${id} RETURNING id`;
        if(!r.length)throw httpError('Không tìm thấy ban');
        await audit(tx,action,{id,name});
      });
    }else if(action==='create_slot'){
      const env=envClean(b.env), cid=intClean(b.committee_id,1,1000), start=startClean(b.start_at), capacity=intClean(b.capacity,1,200);
      await sql.begin(async tx=>{
        await tx`INSERT INTO slots(env,committee_id,start_at,capacity,open) VALUES(${env},${cid},${start},${capacity},true)`;
        await audit(tx,action,{env,cid,start,capacity});
      }).catch(uniqueSlot);
    }else if(action==='edit_slot'){
      const id=intClean(b.slot_id),capacity=intClean(b.capacity,1,200), open=b.open===true, start=b.start_at?startClean(b.start_at):null;
      await sql.begin(async tx=>{
        const [slot]=await tx`SELECT id FROM slots WHERE id=${id} FOR UPDATE`;
        if(!slot)throw httpError('Không tìm thấy ca');
        const [count]=await tx`SELECT COUNT(*)::int AS n FROM registrations WHERE slot_id=${id}`;
        if(count.n>capacity)throw httpError('Sức chứa thấp hơn số sinh viên đã đăng ký');
        if(start){
          // Moving a slot must not leave any of its students without the 15-minute break between sessions.
          const clash=await tx`
            SELECT 1 FROM registrations r
            JOIN registrations o ON o.env=r.env AND o.student_id=r.student_id AND o.id<>r.id
            JOIN slots s ON s.id=o.slot_id
            WHERE r.slot_id=${id} AND abs(extract(epoch FROM s.start_at-${start}::timestamptz))<${MIN_START_GAP_MS/1000} LIMIT 1`;
          if(clash.length)throw httpError('Giờ mới khiến một sinh viên trong ca không còn đủ 15 phút nghỉ giữa hai ca.');
        }
        await tx`UPDATE slots SET capacity=${capacity},open=${open},start_at=COALESCE(${start}::timestamptz,start_at) WHERE id=${id}`;
        await audit(tx,action,{id,capacity,open,start});
      }).catch(uniqueSlot);
    }else if(action==='generate_slots'){
      return res.status(200).json({ok:true,...await generateSlots(sql,envClean(b.env),b,audit)});
    }else if(action==='unlock_student'){
      // Stored MSSVs may predate the current format check, so match the stored value as-is.
      const env=envClean(b.env), sid=String(b.student_id||'').trim().toUpperCase();
      if(!sid||sid.length>64)throw httpError('MSSV không hợp lệ');
      await sql.begin(async tx=>{
        const r=await tx`DELETE FROM registration_locks WHERE env=${env} AND student_id=${sid} RETURNING student_id`;
        if(!r.length)throw httpError('MSSV này không bị khóa');
        await audit(tx,action,{env,student_id:sid});
      });
    }else if(action==='delete_slot'){
      const id=intClean(b.slot_id);
      await sql.begin(async tx=>{
        const [v]=await tx`SELECT id FROM slots WHERE id=${id} FOR UPDATE`;
        if(!v)throw httpError('Không tìm thấy ca');
        const [n]=await tx`SELECT COUNT(*)::int AS n FROM registrations WHERE slot_id=${id}`;
        if(n.n)throw httpError('Ca có đăng ký. Hãy chuyển hoặc hủy các đăng ký trước.');
        await tx`DELETE FROM slots WHERE id=${id}`;
        await audit(tx,action,{id});
      });
    }else if(action==='delete_registration'){
      const id=intClean(b.registration_id);
      await sql.begin(async tx=>{
        const r=await tx`DELETE FROM registrations WHERE id=${id} RETURNING id,env,student_id,slot_id`;
        if(!r.length)throw httpError('Không tìm thấy đăng ký');
        await audit(tx,action,{id,env:r[0].env,slot_id:r[0].slot_id});
      });
    }else if(action==='edit_student'){
      // Fixes a mistyped MSSV/name: the student keeps their slots and the lock moves to the corrected MSSV.
      const env=envClean(b.env), from=String(b.old_student_id||'').trim().toUpperCase(), to=idClean(b.student_id), name=nameClean(b.student_name);
      await sql.begin(async tx=>{
        for(const k of [from,to].sort())await tx`SELECT pg_advisory_xact_lock(hashtext(${env+':'+k}))`;
        const regs=await tx`SELECT id FROM registrations WHERE env=${env} AND student_id=${from} FOR UPDATE`;
        if(!regs.length)throw httpError('Không tìm thấy đăng ký của MSSV cũ');
        if(to!==from){
          const [taken]=await tx`SELECT 1 FROM registrations WHERE env=${env} AND student_id=${to} LIMIT 1`;
          if(taken)throw httpError(`MSSV ${to} đã có đăng ký riêng. Hãy hủy hoặc xử lý đăng ký đó trước.`);
        }
        await tx`UPDATE registrations SET student_id=${to},student_name=${name} WHERE env=${env} AND student_id=${from}`;
        if(to!==from){
          await tx`DELETE FROM registration_locks WHERE env=${env} AND student_id=${from}`;
          await tx`INSERT INTO registration_locks(env,student_id) VALUES(${env},${to}) ON CONFLICT DO NOTHING`;
        }
        await audit(tx,action,{env,from,to,count:regs.length});
      });
    }else if(action==='move_registration'){
      const id=intClean(b.registration_id),newSlot=intClean(b.slot_id);
      await sql.begin(async tx=>{
        const [old0]=await tx`SELECT env,student_id FROM registrations WHERE id=${id}`;
        if(!old0)throw httpError('Không tìm thấy đăng ký');
        await tx`SELECT pg_advisory_xact_lock(hashtext(${old0.env+':'+old0.student_id}))`;
        const [old]=await tx`SELECT * FROM registrations WHERE id=${id} FOR UPDATE`;
        if(!old)throw httpError('Không tìm thấy đăng ký');
        if(old.slot_id===newSlot)throw httpError('Ca mới trùng ca cũ');
        const [target]=await tx`SELECT * FROM slots WHERE id=${newSlot} AND env=${old.env} FOR UPDATE`;
        if(!target || target.committee_id!==old.committee_id)throw httpError('Chỉ hỗ trợ chuyển sang ca khác trong cùng ban');
        if(!target.open)throw httpError('Ca đích đang đóng');
        const [cap]=await tx`SELECT count(*)::int AS n FROM registrations WHERE slot_id=${newSlot}`;
        if(cap.n>=target.capacity)throw httpError('Ca đích đã hết chỗ');
        const conflicts=await tx`
          SELECT s.start_at FROM registrations r JOIN slots s ON s.id=r.slot_id
          WHERE r.env=${old.env} AND r.student_id=${old.student_id} AND r.id<>${id}`;
        if(conflicts.some(x=>!enoughGap(x.start_at,target.start_at)))
          throw httpError('Ca đích: '+GAP_MESSAGE);
        // Keep original lookup_hash to preserve student's device confirmation link.
        await tx`UPDATE registrations SET slot_id=${newSlot} WHERE id=${id}`;
        await audit(tx,action,{registration_id:id,to_slot:newSlot});
      });
    }else throw httpError('Hành động quản trị không hợp lệ');
    res.status(200).json({ok:true});
  }catch(e){console.error('admin',e);fail(res,e);}
}
