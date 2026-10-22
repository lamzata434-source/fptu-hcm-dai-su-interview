import {db} from '../lib/db.js';
import {createRegistration} from '../lib/registration.js';
import {fail,method,jsonBody,noCache,sameOrigin,httpError} from '../lib/http.js';
export default async function handler(req,res){
  noCache(res);
  try{
    method(req,'POST');sameOrigin(req);const body=jsonBody(req);const sql=db();
    const result=await sql.begin(async tx=>{
      const [settings]=await tx`SELECT active_env,registration_open FROM app_settings WHERE singleton=true FOR SHARE`;
      if(!settings?.registration_open)throw httpError('BTC chưa mở đăng ký');
      return createRegistration(tx,body,settings.active_env);
    });
    res.status(201).json({ok:true,registration:result});
  }catch(e){console.error('register',e);fail(res,e);}
}
