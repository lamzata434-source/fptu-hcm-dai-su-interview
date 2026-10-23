const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tz='Asia/Ho_Chi_Minh';
const fmt=d=>new Intl.DateTimeFormat('vi-VN',{timeZone:tz,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
const toISO=(date,time)=>`${date}T${time}:00+07:00`;
const vnLocal=d=>d?new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d)).replace(' ','T'):'';
const fromLocal=v=>v?`${v}:00+07:00`:null;
const dayKey=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
const dayLabel=d=>new Intl.DateTimeFormat('vi-VN',{timeZone:tz,weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d));
const hm=d=>new Intl.DateTimeFormat('vi-VN',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
const COLORS=['#f26f21','#1f5eab','#3fb27a','#9b5de5','#e0457b'];
const ICON_EDIT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
// Slot list view state: filters, expanded day groups, and the single row being edited.
const slotView={committee:'all',status:'all',days:null,editing:null};
const slotStatus=s=>new Date(s.start_at)<=Date.now()?'past':!s.open?'closed':s.registered>=s.capacity?'full':'free';
const STATUS_LABEL={free:'Còn chỗ',full:'Hết chỗ',closed:'Đã khóa',past:'Đã qua'};
const ICON_MOVE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>';
const ICON_ID='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 15H7a4 4 0 0 0-4 4v2"/><path d="M21.4 16.6a1.9 1.9 0 0 0-2.7-2.7l-4.7 4.7-.7 3.4 3.4-.7z"/><circle cx="10" cy="7" r="4"/></svg>';
// Registration list view state: search text, committee filter, expanded days, and the row being moved.
const regView={q:'',committee:'all',days:null,moving:null};
// Accent-insensitive matching so "thao" finds "Thảo".
const fold=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase();
let d=null,csvText='',viewEnv='test';
async function api(path,method='GET',body){const opts={method,headers:{}};if(body!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}const r=await fetch('/api/'+path,opts);const j=await r.json().catch(()=>({error:'Lỗi dữ liệu máy chủ'}));if(!r.ok)throw Object.assign(new Error(j.error||'Có lỗi'),{details:j.details||[]});return j;}
let toastTimer;function message(s,error=false){$('admin-message').className='feedback toast '+(error?'error':'success');$('admin-message').textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('admin-message').textContent='';},error?8000:4000);}
async function init(){try{const s=await api('auth');$('login').hidden=s.admin;$('dashboard').hidden=!s.admin;if(s.admin)await refresh();}catch(e){$('login-message').textContent=e.message;}}
$('login-form').onsubmit=async e=>{e.preventDefault();try{await api('auth','POST',{action:'login',password:$('password').value});$('password').value='';await init();}catch(err){$('login-message').textContent=err.message;}};
$('logout').onclick=async()=>{await api('auth','POST',{action:'logout'});d=null;await init();};
$('env-view').onchange=()=>{viewEnv=$('env-view').value;$('gen-result').hidden=true;refresh();genPreview();};
$('reload').onclick=()=>refresh();
async function refresh(){try{d=await api('admin?env='+viewEnv);render();}catch(e){message(e.message,true);if(e.message.includes('đăng nhập'))await init();}}
function render(){if(!d)return;
 $('env-view').value=viewEnv;$('active-env').value=d.settings.active_env;$('registration-open').value=String(d.settings.registration_open);$('notice-edit').value=d.settings.notice;$('opens-at').value=vnLocal(d.settings.registration_opens_at);$('closes-at').value=vnLocal(d.settings.registration_closes_at);
 $('new-committee').innerHTML=d.committees.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
 $('committee-admin').innerHTML=d.committees.map(c=>`<div class="committee-row"><label for="comname-${c.id}">Ban ${c.id}</label><input id="comname-${c.id}" data-comname="${c.id}" value="${esc(c.name)}"><button class="btn ghost small" type="button" data-rename="${c.id}">Đổi tên</button></div>`).join('');
 const cById=Object.fromEntries(d.committees.map(c=>[c.id,c.name]));
 renderSlots();
 renderGenCommittees();
 renderRegs();
 renderLocks();
}
function renderSlots(){if(!d)return;
 const cIdx=Object.fromEntries(d.committees.map((c,i)=>[c.id,i])),cName=Object.fromEntries(d.committees.map(c=>[c.id,c.name])),dot=id=>`<i style="background:${COLORS[cIdx[id]%COLORS.length]}"></i>`;
 const count=id=>d.slots.filter(s=>id==='all'||s.committee_id===id).length;
 $('slot-committee-filter').innerHTML=[{id:'all',name:'Tất cả ban'},...d.committees].map(c=>`<button type="button" class="chip${slotView.committee===c.id?' active':''}" data-filter-committee="${c.id}" aria-pressed="${slotView.committee===c.id}">${c.id==='all'?'':dot(c.id)}${esc(c.name)} <small>${count(c.id)}</small></button>`).join('');
 const by=st=>d.slots.filter(s=>slotStatus(s)===st).length,reg=d.slots.reduce((n,s)=>n+s.registered,0),cap=d.slots.reduce((n,s)=>n+s.capacity,0);
 $('slot-stats').textContent=`${d.slots.length} ca · ${by('free')} còn chỗ · ${by('full')} hết chỗ · ${by('closed')} đã khóa · đã đăng ký ${reg}/${cap} chỗ`;
 const list=d.slots.filter(s=>(slotView.committee==='all'||s.committee_id===slotView.committee)&&(slotView.status==='all'||slotStatus(s)===slotView.status));
 const groups={};list.forEach(s=>(groups[dayKey(s.start_at)]??=[]).push(s));
 const keys=Object.keys(groups).sort();
 // First view expands only the first day that is not over yet.
 if(!slotView.days){const today=dayKey(Date.now());slotView.days=new Set([keys.find(k=>k>=today)||keys[0]].filter(Boolean));}
 $('slots-admin').classList.toggle('one-committee',slotView.committee!=='all');
 $('slots-admin').innerHTML=keys.map(k=>{const g=groups[k],r=g.reduce((n,s)=>n+s.registered,0),c=g.reduce((n,s)=>n+s.capacity,0);
  return `<details class="slot-day" data-day="${k}"${slotView.days.has(k)?' open':''}><summary><span class="slot-day-title">${esc(dayLabel(g[0].start_at))}</span><span class="slot-day-meta">${g.length} ca · ${r}/${c} chỗ</span><span class="mini-bar"><i style="width:${c?Math.round(r/c*100):0}%"></i></span></summary><table class="slot-table"><tbody>${g.map(s=>slotRow(s,cName,dot)).join('')}</tbody></table></details>`;}).join('')||`<p class="empty">${d.slots.length?'Không có ca phù hợp bộ lọc.':'Chưa có ca. Hãy thêm ca ở trên.'}</p>`;
 syncToggleAll();
}
function syncToggleAll(){const keys=[...$('slots-admin').querySelectorAll('.slot-day')].map(x=>x.dataset.day);$('slots-toggle-all').textContent=keys.length&&keys.every(k=>slotView.days.has(k))?'Thu gọn tất cả':'Mở tất cả';}
function slotRow(s,cName,dot){const st=slotStatus(s),end=new Date(new Date(s.start_at).getTime()+15*60000);
 if(String(s.id)===slotView.editing)return `<tr class="editing"><td colspan="5"><div class="slot-editor"><span class="slot-editor-title">${dot(s.committee_id)}${esc(cName[s.committee_id])} · ${hm(s.start_at)}</span><label>Giờ bắt đầu<input type="datetime-local" value="${vnLocal(s.start_at)}" data-start="${s.id}"></label><label>Số suất<input type="number" min="1" max="200" value="${s.capacity}" data-cap="${s.id}"></label><label>Trạng thái<select data-open="${s.id}"><option value="true" ${s.open?'selected':''}>Mở</option><option value="false" ${!s.open?'selected':''}>Khóa</option></select></label><div class="slot-editor-actions"><button class="btn ghost small" type="button" data-cancel-edit>Hủy</button><button class="btn primary small" type="button" data-edit="${s.id}">Lưu</button></div></div></td></tr>`;
 return `<tr class="st-${st}"><td class="c-time"><b>${hm(s.start_at)}</b><small>–${hm(end)}</small></td><td class="c-ban">${dot(s.committee_id)}${esc(cName[s.committee_id])}</td><td class="c-seats"><span>${s.registered}/${s.capacity}</span><span class="mini-bar"><i style="width:${Math.round(s.registered/s.capacity*100)}%"></i></span></td><td class="c-status"><span class="badge-st ${st}">${STATUS_LABEL[st]}</span></td><td class="c-act"><button class="icon-btn" type="button" data-start-edit="${s.id}" title="Sửa ca" aria-label="Sửa ca ${hm(s.start_at)} ${esc(cName[s.committee_id])}">${ICON_EDIT}</button><button class="icon-btn danger" type="button" data-delete-slot="${s.id}" title="Xóa ca" aria-label="Xóa ca ${hm(s.start_at)} ${esc(cName[s.committee_id])}">${ICON_TRASH}</button></td></tr>`;}
function renderRegs(){if(!d)return;
 const cIdx=Object.fromEntries(d.committees.map((c,i)=>[c.id,i])),dot=id=>`<i style="background:${COLORS[cIdx[id]%COLORS.length]}"></i>`;
 const count=id=>d.registrations.filter(r=>id==='all'||r.committee_id===id).length;
 $('stats').textContent=`${d.registrations.length} lượt đăng ký · ${new Set(d.registrations.map(r=>r.student_id)).size} sinh viên`;
 $('reg-committee-filter').innerHTML=[{id:'all',name:'Tất cả ban'},...d.committees].map(c=>`<button type="button" class="chip${regView.committee===c.id?' active':''}" data-filter-committee="${c.id}" aria-pressed="${regView.committee===c.id}">${c.id==='all'?'':dot(c.id)}${esc(c.name)} <small>${count(c.id)}</small></button>`).join('');
 const q=fold(regView.q.trim());
 const list=d.registrations.filter(r=>(regView.committee==='all'||r.committee_id===regView.committee)&&(!q||fold(r.student_id).includes(q)||fold(r.student_name).includes(q)));
 list.sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)||a.student_name.localeCompare(b.student_name,'vi'));
 const groups={};list.forEach(r=>(groups[dayKey(r.start_at)]??=[]).push(r));
 const keys=Object.keys(groups).sort();
 if(!regView.days){const today=dayKey(Date.now());regView.days=new Set([keys.find(k=>k>=today)||keys[0]].filter(Boolean));}
 // While searching, every day with a match is shown open.
 const isOpen=k=>!!q||regView.days.has(k);
 $('registrations-admin').classList.toggle('one-committee',regView.committee!=='all');
 $('registrations-admin').innerHTML=keys.map(k=>{const g=groups[k];
  return `<details class="slot-day" data-day="${k}"${isOpen(k)?' open':''}><summary><span class="slot-day-title">${esc(dayLabel(g[0].start_at))}</span><span class="slot-day-meta">${g.length} lượt · ${new Set(g.map(r=>r.student_id)).size} sinh viên</span></summary><table class="slot-table reg-table"><tbody>${g.map(r=>regRow(r,dot)).join('')}</tbody></table></details>`;}).join('')||`<p class="empty">${d.registrations.length?'Không tìm thấy đăng ký phù hợp.':'Chưa có sinh viên đăng ký.'}</p>`;
 syncRegToggle();
}
function syncRegToggle(){const keys=[...$('registrations-admin').querySelectorAll('.slot-day')].map(x=>x.dataset.day);$('reg-toggle-all').textContent=keys.length&&keys.every(k=>regView.days.has(k))?'Thu gọn tất cả':'Mở tất cả';}
function regRow(r,dot){const end=new Date(new Date(r.start_at).getTime()+15*60000);
 if(String(r.id)===regView.moving){const opts=d.slots.filter(s=>s.committee_id===r.committee_id&&String(s.id)!==String(r.slot_id)&&s.registered<s.capacity).map(s=>`<option value="${s.id}">${esc(fmt(s.start_at))} · còn ${s.capacity-s.registered} chỗ</option>`).join('');
  return `<tr class="editing"><td colspan="4"><div class="slot-editor"><span class="slot-editor-title">${dot(r.committee_id)}${esc(r.student_name)} · ${esc(r.student_id)} · ${esc(r.committee_name)} ${hm(r.start_at)}</span><label>Chuyển sang ca<select data-move-select="${r.id}"><option value="">${opts?'Chọn ca mới':'Không có ca trống trong ban này'}</option>${opts}</select></label><div class="slot-editor-actions"><button class="btn ghost small" type="button" data-cancel-move>Hủy</button><button class="btn primary small" type="button" data-move="${r.id}">Chuyển ca</button></div></div></td></tr>`;}
 return `<tr><td class="c-time"><b>${hm(r.start_at)}</b><small>–${hm(end)}</small></td><td class="c-student"><b>${esc(r.student_name)}</b><small>${esc(r.student_id)}</small></td><td class="c-ban">${dot(r.committee_id)}${esc(r.committee_name)}</td><td class="c-act"><button class="icon-btn" type="button" data-start-move="${r.id}" title="Chuyển ca" aria-label="Chuyển ca cho ${esc(r.student_name)}">${ICON_MOVE}</button><button class="icon-btn" type="button" data-edit-student="${esc(r.student_id)}" data-name="${esc(r.student_name)}" title="Sửa MSSV / họ tên" aria-label="Sửa MSSV của ${esc(r.student_name)}">${ICON_ID}</button><button class="icon-btn danger" type="button" data-del-reg="${r.id}" title="Hủy đăng ký" aria-label="Hủy đăng ký của ${esc(r.student_name)}">${ICON_TRASH}</button></td></tr>`;}
function renderLocks(){if(!d)return;const q=$('lock-search').value.trim().toLowerCase();const rows=d.locks.filter(l=>!q||l.student_id.toLowerCase().includes(q)||String(l.student_name||'').toLowerCase().includes(q));
 $('locks-admin').innerHTML=rows.map(l=>`<tr><td><b>${esc(l.student_id)}</b></td><td>${esc(l.student_name||'—')}</td><td>${l.registered}</td><td>${esc(fmt(l.created_at))}</td><td><button class="btn ghost small" data-unlock="${esc(l.student_id)}">Mở khóa</button></td></tr>`).join('')||`<tr><td colspan="5">${q?'Không tìm thấy MSSV phù hợp.':'Chưa có MSSV nào gửi đăng ký.'}</td></tr>`;
}
async function apply(body,success){try{await api('admin','POST',body);message(success||'Lưu thành công');await refresh();return true;}catch(err){message(err.message,true);return false;}}
$('settings-form').onsubmit=e=>{e.preventDefault();apply({action:'settings',active_env:$('active-env').value,registration_open:$('registration-open').value==='true',notice:$('notice-edit').value,registration_opens_at:fromLocal($('opens-at').value),registration_closes_at:fromLocal($('closes-at').value)},'Đã cập nhật thiết lập.');};
$('slot-form').onsubmit=e=>{e.preventDefault();if(!$('slot-time').value){message('Hãy chọn giờ.',true);return;}apply({action:'create_slot',env:viewEnv,committee_id:Number($('new-committee').value),start_at:toISO($('slot-date').value,$('slot-time').value),capacity:Number($('slot-capacity').value)},'Đã thêm ca mới.');};
$('committee-admin').onclick=e=>{const b=e.target.closest('[data-rename]');if(b){const id=Number(b.dataset.rename);apply({action:'rename_committee',committee_id:id,name:document.querySelector(`[data-comname="${id}"]`).value},'Đã đổi tên ban.');}};
$('slots-admin').onclick=async e=>{const start=e.target.closest('[data-start-edit]');if(start){slotView.editing=start.dataset.startEdit;renderSlots();document.querySelector(`[data-start="${slotView.editing}"]`)?.focus();return;}if(e.target.closest('[data-cancel-edit]')){slotView.editing=null;renderSlots();return;}
 const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete-slot]');if(edit){const id=edit.dataset.edit;if(await apply({action:'edit_slot',slot_id:Number(id),capacity:Number(document.querySelector(`[data-cap="${id}"]`).value),open:document.querySelector(`[data-open="${id}"]`).value==='true',start_at:fromLocal(document.querySelector(`[data-start="${id}"]`).value)},'Đã cập nhật ca.')){slotView.editing=null;renderSlots();}}if(del){if(confirm('Xóa ca này? Ca có đăng ký sẽ không được xóa.'))apply({action:'delete_slot',slot_id:Number(del.dataset.deleteSlot)},'Đã xóa ca.');}};
// Automatic schedule generator. The preview mirrors lib/schedule.js planSchedule; the server re-validates.
const genIds=()=>[...document.querySelectorAll('#gen-committees input:checked')].map(x=>Number(x.value));
function renderGenCommittees(){if(!d)return;const prev=new Set(document.querySelectorAll('#gen-committees input').length?genIds():d.committees.map(c=>c.id));
 const cIdx=Object.fromEntries(d.committees.map((c,i)=>[c.id,i]));
 $('gen-committees').innerHTML=d.committees.map(c=>`<label class="chip check"><input type="checkbox" value="${c.id}"${prev.has(c.id)?' checked':''}><i style="background:${COLORS[cIdx[c.id]%COLORS.length]}"></i>${esc(c.name)}</label>`).join('');
 if(!$('gen-from').value){const t=dayKey(Date.now()+86400000);$('gen-from').value=t;$('gen-to').value=t;}
 genPreview();}
const minutes=v=>{const m=/^(\d\d):(\d\d)$/.exec(v||'');return m?+m[1]*60+ +m[2]:null;};
function genPreview(){const ids=genIds(),from=$('gen-from').value,to=$('gen-to').value,st=minutes($('gen-start').value),en=minutes($('gen-end').value),bs=minutes($('gen-break-start').value),be=minutes($('gen-break-end').value);
 const days=from&&to?Math.round((Date.parse(to)-Date.parse(from))/86400000)+1:0;let per=0;
 if(st!==null&&en!==null)for(let t=st;t+15<=en;t+=15)if(!(bs!==null&&be!==null&&t<be&&t+15>bs))per++;
 const env=viewEnv==='live'?'Chính thức':'Chạy thử';
 $('gen-preview').innerHTML=ids.length&&days>0&&per>0?`Sẽ tạo tối đa <b>${per*ids.length*days} ca</b> = ${per} ca/ngày × ${ids.length} ban × ${days} ngày, vào môi trường <b>${env}</b>.`:'Chọn ban, ngày và khung giờ để xem trước số ca.';}
function genResult(kind,title,items=[]){const box=$('gen-result');box.hidden=false;box.className='gen-result '+kind;
 box.innerHTML=`<b>${esc(title)}</b>${items.length?`<ul>${items.map(x=>`<li class="${x.warn?'warn':''}">${esc(x.text??x)}</li>`).join('')}</ul>`:''}`;box.scrollIntoView({behavior:'smooth',block:'nearest'});}
$('gen-form').oninput=genPreview;
$('gen-form').onsubmit=async e=>{e.preventDefault();
 const body={action:'generate_slots',env:viewEnv,committee_ids:genIds(),from_date:$('gen-from').value,to_date:$('gen-to').value,start_time:$('gen-start').value,end_time:$('gen-end').value,break_start:$('gen-break-start').value,break_end:$('gen-break-end').value,capacity:Number($('gen-capacity').value)};
 if(viewEnv==='live'&&!confirm('Tạo lịch vào môi trường CHÍNH THỨC?'))return;
 $('gen-submit').disabled=true;$('gen-submit').textContent='Đang tạo lịch…';
 try{const r=await api('admin','POST',body);
  const shown=viewEnv===d.settings.active_env;
  genResult(r.warnings.length?'warn':'ok',`Đã tạo ${r.created}/${r.planned} ca.${shown?' Lịch đã hiển thị ngay trên trang đăng ký của sinh viên.':''}${r.warnings.length?' Xem cảnh báo bên dưới.':''}`,[...r.skipped,...r.warnings.map(text=>({text,warn:true}))]);
  message(`Đã tạo ${r.created} ca mới.`);slotView.days=null;await refresh();}
 catch(err){genResult('error',err.message,err.details.filter(x=>!err.message.includes(x)));message(err.message,true);}
 finally{$('gen-submit').disabled=false;$('gen-submit').textContent='Tạo lịch';}};
$('slot-committee-filter').onclick=e=>{const b=e.target.closest('[data-filter-committee]');if(!b)return;const v=b.dataset.filterCommittee;slotView.committee=v==='all'?'all':Number(v);renderSlots();};
$('slot-status-filter').onchange=e=>{slotView.status=e.target.value;renderSlots();};
$('slots-toggle-all').onclick=()=>{const keys=[...$('slots-admin').querySelectorAll('.slot-day')].map(x=>x.dataset.day),all=keys.every(k=>slotView.days.has(k));slotView.days=new Set(all?[]:keys);renderSlots();};
// toggle does not bubble, so listen in the capture phase to remember which days are open across re-renders.
$('slots-admin').addEventListener('toggle',e=>{const x=e.target;if(!x.classList?.contains('slot-day'))return;if(x.open)slotView.days.add(x.dataset.day);else slotView.days.delete(x.dataset.day);syncToggleAll();},true);
$('reg-search').oninput=e=>{regView.q=e.target.value;renderRegs();};
$('reg-committee-filter').onclick=e=>{const b=e.target.closest('[data-filter-committee]');if(!b)return;const v=b.dataset.filterCommittee;regView.committee=v==='all'?'all':Number(v);renderRegs();};
$('reg-toggle-all').onclick=()=>{const keys=[...$('registrations-admin').querySelectorAll('.slot-day')].map(x=>x.dataset.day),all=keys.every(k=>regView.days.has(k));regView.days=new Set(all?[]:keys);renderRegs();};
$('registrations-admin').addEventListener('toggle',e=>{const x=e.target;if(!x.classList?.contains('slot-day')||regView.q.trim())return;if(x.open)regView.days.add(x.dataset.day);else regView.days.delete(x.dataset.day);syncRegToggle();},true);
$('registrations-admin').onclick=async e=>{const start=e.target.closest('[data-start-move]');if(start){regView.moving=start.dataset.startMove;renderRegs();document.querySelector(`[data-move-select="${regView.moving}"]`)?.focus();return;}if(e.target.closest('[data-cancel-move]')){regView.moving=null;renderRegs();return;}const fix=e.target.closest('[data-edit-student]');if(fix){const old=fix.dataset.editStudent,id=prompt(`MSSV đúng cho ${old} (áp dụng cho mọi ca của sinh viên này):`,old);if(id===null)return;const name=prompt('Họ và tên:',fix.dataset.name);if(name===null)return;return apply({action:'edit_student',env:viewEnv,old_student_id:old,student_id:id.trim().toUpperCase(),student_name:name},'Đã sửa thông tin sinh viên.');}const move=e.target.closest('[data-move]'),del=e.target.closest('[data-del-reg]');if(move){const id=move.dataset.move,v=document.querySelector(`[data-move-select="${id}"]`).value;if(!v)return message('Hãy chọn ca mới.',true);if(confirm('Chuyển ca của sinh viên này?')&&await apply({action:'move_registration',registration_id:Number(id),slot_id:Number(v)},'Đã chuyển ca.')){regView.moving=null;renderRegs();}}if(del){if(confirm('Hủy đăng ký này? Không thể hoàn tác!'))apply({action:'delete_registration',registration_id:Number(del.dataset.delReg)},'Đã hủy đăng ký.');}};
$('lock-search').oninput=renderLocks;
$('locks-admin').onclick=e=>{const b=e.target.closest('[data-unlock]');if(b&&confirm(`Mở khóa MSSV ${b.dataset.unlock}? Sinh viên sẽ được gửi đăng ký thêm một lần.`))apply({action:'unlock_student',env:viewEnv,student_id:b.dataset.unlock},'Đã mở khóa MSSV.');};
$('export').onclick=()=>{window.location.href='/api/export?env='+viewEnv;};
$('import-file').onchange=async e=>{csvText='';$('confirm-import').disabled=true;$('import-preview').textContent='';const f=e.target.files?.[0];if(!f)return;if(f.size>550000){message('Tệp tối đa 550KB. Chia nhỏ thành các phần 150 dòng.',true);return;}csvText=await f.text();};
$('preview-import').onclick=async()=>{if(!csvText)return message('Chọn tệp CSV trước.',true);try{const j=await api('import','POST',{env:viewEnv,csv:csvText,preview:true});$('import-preview').textContent=JSON.stringify(j,null,2);$('confirm-import').disabled=j.total===0||j.invalid>0;message(`Đã xem trước ${j.total} dòng; ${j.invalid} dòng có lỗi.`);}catch(e){message(e.message,true);}};
$('confirm-import').onclick=async()=>{if(!csvText||!confirm(`Nhập CSV vào môi trường ${viewEnv==='test'?'CHẠY THỬ':'CHÍNH THỨC'}?`))return;try{const j=await api('import','POST',{env:viewEnv,csv:csvText,confirm:true});$('import-preview').textContent=JSON.stringify(j,null,2);$('confirm-import').disabled=true;csvText='';message(`Đã nhập ${j.imported}/${j.total}; lỗi ${j.failed}. Hãy xem kết quả bên dưới.`,j.failed>0);await refresh();}catch(e){message(e.message,true);}};
await init();
