import crypto from 'node:crypto';
const COOKIE = 'fptu_admin';
export function fail(res, e) { 
  const code = e?.status || 400;
  if (code >= 500) return res.status(code).json({error: 'Lỗi máy chủ. Liên hệ quản trị viên.'});
  // details: optional list of specific problems (e.g. each schedule configuration error) for the admin UI.
  res.status(code).json({error: String(e.message || e), ...(Array.isArray(e.details) && e.details.length ? {details: e.details} : {})});
}
export function httpError(message, status=400) {const e=new Error(message);e.status=status;return e;}
export function method(req, verb) { if(req.method!==verb) throw httpError('Phương thức không được hỗ trợ',405); }
export function jsonBody(req){ if(!req.body || typeof req.body!=='object' || Array.isArray(req.body)) throw httpError('Dữ liệu JSON không hợp lệ'); return req.body; }
export function noCache(res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');}
export function sameOrigin(req){
  const origin = req.headers.origin;
  if (!origin) return; // clients without Origin (e.g. server-to-server); SameSite cookies mitigate CSRF
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let u; try{u=new URL(origin);}catch{throw httpError('Origin không hợp lệ',403);}
  if(u.host !== host || !['https:','http:'].includes(u.protocol)) throw httpError('Yêu cầu khác nguồn bị chặn',403);
}
function secret(){const s=process.env.AUTH_SECRET||'';if(s.length<32)throw httpError('AUTH_SECRET chưa cấu hình đủ mạnh',503);return s;}
function sign(raw){return crypto.createHmac('sha256',secret()).update(raw).digest('base64url');}
export function issueAdmin(res,req){
  const raw=Buffer.from(JSON.stringify({exp:Date.now()+8*60*60*1000, n:crypto.randomBytes(16).toString('hex')})).toString('base64url');
  const secure = (req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL === '1') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${raw}.${sign(raw)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${secure}`);
}
export function clearAdmin(res){res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0; Secure`);}
export function admin(req){
  const cookie = String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`));
  if(!cookie) return false;
  const [raw,sig] = cookie.slice(COOKIE.length+1).split('.');
  if(!raw||!sig) return false;
  const a=Buffer.from(sig), b=Buffer.from(sign(raw));
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b))return false;
  try{return JSON.parse(Buffer.from(raw,'base64url').toString()).exp > Date.now();}catch{return false;}
}
export function requireAdmin(req){if(!admin(req)) throw httpError('Cần đăng nhập quản trị',401);}
export function matchPassword(input){
  const password=process.env.ADMIN_PASSWORD||'';
  if(password.length<16) throw httpError('ADMIN_PASSWORD cần dài ít nhất 16 ký tự',503);
  const hash = s => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(hash(input),hash(password));
}
export function ipHash(req){
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  return crypto.createHash('sha256').update((process.env.AUTH_SECRET||'')+':'+ip).digest('hex');
}
