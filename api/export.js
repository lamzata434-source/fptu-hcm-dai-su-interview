import {db} from '../lib/db.js';
import {fail,method,noCache,requireAdmin} from '../lib/http.js';
import {envClean,csvCell} from '../lib/validation.js';

export function formatVietnamDateTime(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp in export');
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const p = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );

  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export default async function handler(req,res){
  noCache(res);
  try{
    requireAdmin(req);method(req,'GET');const env=envClean(String(req.query?.env||'test'));
    const sql=db();
    const rows=await sql`
      SELECT r.id,r.student_name,r.student_id,c.name AS committee_name,
        s.start_at,s.capacity,r.created_at,r.env,s.room,r.subteam
      FROM registrations r JOIN slots s ON s.id=r.slot_id
      JOIN committees c ON c.id=r.committee_id
      WHERE r.env=${env} ORDER BY s.start_at,c.id,r.student_id`;
    const headers=['id','student_name','student_id','committee','start_at','capacity','created_at','environment','room','subteam'];
    const cells = rows.map(r => [
  r.id,
  r.student_name,
  r.student_id,
  r.committee_name,
  formatVietnamDateTime(r.start_at),
  r.capacity,
  formatVietnamDateTime(r.created_at),
  r.env,
  r.room,
  r.subteam
]);
    const csv='\ufeff'+[headers,...cells].map(row=>row.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="dang-ky-dai-su-${env}.csv"`);
    res.status(200).send(csv);
  }catch(e){console.error('export',e);fail(res,e);}
}
