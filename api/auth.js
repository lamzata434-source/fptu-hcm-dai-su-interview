import {db} from '../lib/db.js';
import {fail,jsonBody,noCache,method,sameOrigin,matchPassword,admin,issueAdmin,clearAdmin,ipHash,httpError} from '../lib/http.js';
export default async function handler(req,res){
  noCache(res);
  try{
    if(req.method==='GET')return res.status(200).json({admin:admin(req)});
    method(req,'POST');sameOrigin(req);const body=jsonBody(req);
    if(body.action==='logout'){clearAdmin(res);return res.status(200).json({ok:true});}
    if(body.action!=='login')throw httpError('Hành động không hợp lệ');
    const sql=db(), ip=ipHash(req);
    const [v]=await sql`
      INSERT INTO auth_attempts(ip_hash,attempts,updated_at) VALUES(${ip},0,now())
      ON CONFLICT (ip_hash) DO UPDATE SET
        attempts=CASE WHEN auth_attempts.updated_at < now()-interval '15 minutes' THEN 0 ELSE auth_attempts.attempts END,
        updated_at=CASE WHEN auth_attempts.updated_at < now()-interval '15 minutes' THEN now() ELSE auth_attempts.updated_at END
      RETURNING attempts`;
    if(v.attempts>=5)throw httpError('Thử quá nhiều lần. Vui lòng quay lại sau 15 phút.',429);
    if(!matchPassword(body.password)){
      await sql`UPDATE auth_attempts SET attempts=attempts+1 WHERE ip_hash=${ip}`;
      throw httpError('Mật khẩu không đúng',401);
    }
    await sql`DELETE FROM auth_attempts WHERE ip_hash=${ip}`;
    issueAdmin(res,req);res.status(200).json({ok:true});
  }catch(e){console.error('auth',e);fail(res,e);}
}
