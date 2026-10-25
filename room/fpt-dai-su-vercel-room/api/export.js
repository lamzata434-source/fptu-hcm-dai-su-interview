import {db} from '../lib/db.js';
import {fail,method,noCache,requireAdmin} from '../lib/http.js';
import {envClean,csvCell} from '../lib/validation.js';
export default async function handler(req,res){
  noCache(res);
  try{
    requireAdmin(req);method(req,'GET');const env=envClean(String(req.query?.env||'test'));
    const sql=db();
    const rows=await sql`
      SELECT r.id,r.student_name,r.student_id,c.name AS committee_name,
        s.start_at,s.room,s.capacity,r.created_at,r.env
      FROM registrations r JOIN slots s ON s.id=r.slot_id
      JOIN committees c ON c.id=r.committee_id
      WHERE r.env=${env} ORDER BY s.start_at,c.id,r.student_id`;
    const headers=['id','student_name','student_id','committee','start_at','room','capacity','created_at','environment'];
    const cells=rows.map(r=>[r.id,r.student_name,r.student_id,r.committee_name,new Date(r.start_at).toISOString(),r.room,r.capacity,new Date(r.created_at).toISOString(),r.env]);
    const csv='\ufeff'+[headers,...cells].map(row=>row.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="dang-ky-dai-su-${env}.csv"`);
    res.status(200).send(csv);
  }catch(e){console.error('export',e);fail(res,e);}
}
