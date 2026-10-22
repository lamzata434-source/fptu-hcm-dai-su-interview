import crypto from 'node:crypto';
import {db} from '../lib/db.js';
import {fail,method,noCache,jsonBody,sameOrigin} from '../lib/http.js';
export default async function handler(req,res){
  noCache(res);
  try{
    method(req,'POST');sameOrigin(req);const body=jsonBody(req);
    const tokens=Array.isArray(body.tokens)?body.tokens.filter(x=>typeof x==='string' && /^[a-zA-Z0-9_-]{32}$/.test(x)).slice(0,15):[];
    if(!tokens.length)return res.status(200).json({registrations:[]});
    const hashes=tokens.map(t=>crypto.createHash('sha256').update(t).digest('hex'));
    const sql=db();
    const result=await sql`
      SELECT r.id,r.student_name,r.student_id,r.env,r.created_at,c.name AS committee_name,s.start_at
      FROM registrations r JOIN committees c ON c.id=r.committee_id JOIN slots s ON s.id=r.slot_id
      WHERE r.lookup_hash IN ${sql(hashes)} ORDER BY s.start_at`;
    res.status(200).json({registrations:result});
  }catch(e){fail(res,e);}
}
