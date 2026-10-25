import {parse} from 'csv-parse/sync';
import {db} from '../lib/db.js';
import {createRegistration} from '../lib/registration.js';
import {fail,method,noCache,requireAdmin,jsonBody,sameOrigin,httpError} from '../lib/http.js';
import {envClean,startClean,idClean,nameClean} from '../lib/validation.js';
const keys = Object.fromEntries([]);
function normalizeKey(k){return String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function get(row,...headers){const norm=Object.fromEntries(Object.entries(row).map(([k,v])=>[normalizeKey(k),v]));for(const h of headers){const x=norm[normalizeKey(h)];if(x!=null && String(x).trim())return String(x).trim();}return '';}
function normalizeDate(v){
  v=String(v||'').trim();
  if(/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v))return startClean(/(Z|[+-]\d\d:\d\d)$/.test(v)?v:v.replace(' ','T')+'+07:00');
  const m=v.match(/^(\d\d?)\/(\d\d?)\/(\d{4})\s+(\d\d?):(\d\d)/);
  if(m){const pad=n=>String(n).padStart(2,'0');return startClean(`${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4])}:${m[5]}:00+07:00`);}
  return '';
}
function mapRow(row){
  const student_name=get(row,'student_name','ho va ten','ho ten','name');
  const student_id=get(row,'student_id','mssv','ma so sinh vien','ma sinh vien');
  const committee=get(row,'committee','ban','ten ban');
  const start=get(row,'start_at','thoi gian','phien phong van','ca phong van','slot_start','start','bat dau');
  const d=get(row,'ngay','date'),time=get(row,'gio','time'),subteam=get(row,'subteam','nhom','team');
  return {student_name:nameClean(student_name),student_id:idClean(student_id),committee,subteam,
    start_at:normalizeDate(start)||normalizeDate(`${d} ${time}`)};
}
export default async function handler(req,res){
  noCache(res);
  try{
    requireAdmin(req);method(req,'POST');sameOrigin(req);
    const b=jsonBody(req),env=envClean(b.env);
    if(typeof b.csv!=='string' || b.csv.length>550000)throw httpError('CSV không hợp lệ hoặc quá 550KB');
    let rows;
    try{rows=parse(b.csv,{columns:true,bom:true,skip_empty_lines:true,trim:true,relax_quotes:false});}
    catch{throw httpError('Không đọc được tệp CSV');}
    if(rows.length>150)throw httpError('Mỗi lần nhập tối đa 150 dòng. Hãy tách file CSV lớn.');
    const mapped=rows.map((r,i)=>{try{return {row:i+2,data:mapRow(r)};}catch(e){return {row:i+2,error:e.message};}});
    if(b.preview===true)return res.status(200).json({total:rows.length,preview:mapped.slice(0,15),invalid:mapped.filter(x=>x.error).length});
    if(b.confirm!==true)throw httpError('Cần xác nhận trước khi nhập dữ liệu');
    const sql=db(),success=[],errors=[];
    for(const line of mapped){
      if(line.error){errors.push({row:line.row,error:line.error});continue;}
      try{
        const x=line.data;
        if(!x.start_at||!x.committee)throw httpError('Thiếu tên ban hoặc thời gian phiên');
        const result=await sql.begin(async tx=>{
          const committees=await tx`SELECT id FROM committees WHERE lower(name)=lower(${x.committee})`;
          if(committees.length!==1)throw httpError(`Tên ban chưa có: ${x.committee}`);
          const committee_id=committees[0].id;
          const slots=await tx`SELECT id,subteam FROM slots WHERE env=${env} AND committee_id=${committee_id} AND start_at=${x.start_at}`;
          if(!slots.length)throw httpError('Chưa có phiên tương ứng. Hãy tạo lịch trước khi nhập.');
          // Subteams of one committee may have sessions at the same time; the subteam column picks one.
          const slot=slots.find(s=>s.subteam===x.subteam)||(slots.length===1?slots[0]:null);
          if(!slot)throw httpError('Có nhiều phiên cùng giờ cho các nhóm khác nhau. Thêm cột subteam để chọn đúng phiên.');
          const r=await createRegistration(tx,{...x,slot_id:slot.id},env,{skipPast:true,allowClosed:true,allowNoSubteam:true});
          await tx`INSERT INTO registration_locks(env,student_id) VALUES(${env},${r.student_id}) ON CONFLICT DO NOTHING`;
          await tx`INSERT INTO admin_audit(action,details) VALUES('import_csv',${JSON.stringify({registration_id:r.id,row:line.row,env})}::jsonb)`;
          return r;
        });
        success.push({row:line.row,id:result.id});
      }catch(e){errors.push({row:line.row,error:e.message});}
    }
    res.status(200).json({ok:true,total:rows.length,imported:success.length,failed:errors.length,errors:errors.slice(0,80)});
  }catch(e){console.error('import',e);fail(res,e);}
}
