import {db} from '../lib/db.js';
import {fail,method,noCache} from '../lib/http.js';
export default async function handler(req,res){
  noCache(res);
  try{
    method(req,'GET');const sql=db();
    const [settings]=await sql`SELECT active_env,registration_open,notice FROM app_settings WHERE singleton=true`;
    if(!settings)throw new Error('Chưa khởi tạo database');
    const committees=await sql`SELECT id,name FROM committees ORDER BY id`;
    const slots=await sql`
      SELECT s.id,s.committee_id,s.start_at,s.room,s.capacity,s.open,COUNT(r.id)::int AS registered
      FROM slots s LEFT JOIN registrations r ON r.slot_id=s.id
      WHERE s.env=${settings.active_env}
      GROUP BY s.id ORDER BY s.start_at,s.committee_id`;
    res.status(200).json({settings,committees,slots,server_time:new Date().toISOString()});
  }catch(e){console.error('public',e);fail(res,e);}
}
