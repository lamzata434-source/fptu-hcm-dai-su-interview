import {db} from '../lib/db.js';
import {noCache,fail} from '../lib/http.js';
export default async function handler(req,res){
 noCache(res);
 try{const sql=db();const [r]=await sql`SELECT 1 AS ok`;res.status(200).json({ok:!!r});}
 catch(e){console.error('health',e);fail(res,e);}
}
