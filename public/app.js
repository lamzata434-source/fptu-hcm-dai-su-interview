const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TZ='Asia/Ho_Chi_Minh';
const dateFmt=d=>new Intl.DateTimeFormat('vi-VN',{timeZone:TZ,weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d));
const timeFmt=d=>new Intl.DateTimeFormat('vi-VN',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
const dateKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
let state=null,selectedCommittee=null,selectedSlot=null,blocked=false;
const tokensKey='fptu_dai_su_registration_tokens_v1';
async function api(path,method='GET',data){
 const opts={method,headers:{}};
 if(data!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(data);}
 const r=await fetch('/api/'+path,opts),json=await r.json().catch(()=>({error:'Không đọc được phản hồi máy chủ'}));
 if(!r.ok)throw new Error(json.error||'Yêu cầu thất bại');return json;
}
function feedback(text,cls='error'){$('feedback').className='feedback '+cls;$('feedback').textContent=text;}
function selectedText(){
 const slot=state?.slots.find(x=>String(x.id)===String(selectedSlot));
 const ban=state?.committees.find(x=>x.id===slot?.committee_id);
 $('selected-slot').textContent=slot?`${ban?.name||'Ban'} • ${timeFmt(slot.start_at)} • ${dateFmt(slot.start_at)}`:'Chưa chọn ca phỏng vấn';
 $('submit-btn').disabled=!slot||!state?.settings.registration_open||!slot.open||slot.registered>=slot.capacity||new Date(slot.start_at)<=Date.now()||blocked;
}
function render(){
 if(!state)return;
 $('environment-badge').textContent=state.settings.active_env==='test'?'● Môi trường chạy thử':'● Đăng ký chính thức';
 $('notice').textContent=state.settings.notice+(state.settings.registration_open?'':' Hiện chưa mở nhận đăng ký.');
 if(!state.committees.some(x=>x.id===selectedCommittee))selectedCommittee=state.committees[0]?.id??null;
 $('committee-tabs').innerHTML=state.committees.map(c=>`<button class="tab ${c.id===selectedCommittee?'active':''}" data-committee="${c.id}" role="tab" aria-selected="${c.id===selectedCommittee}">${esc(c.name)}</button>`).join('');
 const slots=state.slots.filter(x=>x.committee_id===selectedCommittee),grouped=Object.groupBy?Object.groupBy(slots,x=>dateKey(x.start_at)):slots.reduce((g,s)=>((g[dateKey(s.start_at)]??=[]).push(s),g),{});
 if(!slots.length){$('slots').innerHTML='<div class="empty">Chưa có lịch cho ban này.<br>BTC sẽ cập nhật khi có ca phỏng vấn.</div>';}
 else $('slots').innerHTML=Object.entries(grouped).map(([date,group])=>`<div class="date-title">${esc(dateFmt(group[0].start_at))}</div><div class="slots-grid">${group.map(s=>{
 const full=s.registered>=s.capacity,past=new Date(s.start_at)<=Date.now(),off=!s.open||full||past||!state.settings.registration_open;
 return `<button class="slot ${String(selectedSlot)===String(s.id)?'selected':''}" data-slot="${s.id}" ${off?'disabled':''}><b>${esc(timeFmt(s.start_at))}</b><small class="${full?'full':''}">${past?'Đã qua':!s.open?'Đã khóa':full?'Hết chỗ':`${s.capacity-s.registered}/${s.capacity} chỗ còn`}</small></button>`;
 }).join('')}</div>`).join('');
 selectedText();
 $('refresh-info').textContent='Đồng bộ tự động mỗi 15 giây • Cập nhật: '+new Date().toLocaleTimeString('vi-VN');
}
$('committee-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-committee]');if(!b)return;selectedCommittee=Number(b.dataset.committee);render();});
$('slots').addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;selectedSlot=Number(b.dataset.slot);feedback('','');render();});
async function refresh(){try{state=await api('public');render();}catch(e){$('notice').textContent=e.message;}}
$('refresh').addEventListener('click',refresh);
$('registration-form').addEventListener('submit',async e=>{
 e.preventDefault();if(blocked||!selectedSlot)return;
 blocked=true;selectedText();feedback('Đang xác nhận đăng ký…','');
 try{
  const data=await api('register','POST',{student_name:$('full-name').value,student_id:$('student-id').value,slot_id:selectedSlot});
  const existing=JSON.parse(localStorage.getItem(tokensKey)||'[]');existing.push(data.registration.lookup_token);
  localStorage.setItem(tokensKey,JSON.stringify([...new Set(existing)]));
  feedback(`Đăng ký thành công! ${data.registration.committee_name} lúc ${timeFmt(data.registration.start_at)}. Lịch đã lưu trên thiết bị này.`,'success');
  selectedSlot=null;await refresh();await refreshMy();
 }catch(err){feedback(err.message,'error');await refresh();}
 finally{blocked=false;selectedText();}
});
async function refreshMy(){
 let tokens=[];try{tokens=JSON.parse(localStorage.getItem(tokensKey)||'[]');}catch{}
 if(!Array.isArray(tokens)||!tokens.length){$('my-registrations').textContent='Chưa có lịch được lưu trên thiết bị này.';return;}
 try{
  const {registrations}=await api('my','POST',{tokens});
  $('my-registrations').innerHTML=registrations.length?registrations.map(r=>`<div class="my-item"><div><b>${esc(r.committee_name)}</b> · ${esc(r.student_name)} (${esc(r.student_id)})</div><div>${esc(timeFmt(r.start_at))} • ${esc(dateFmt(r.start_at))} ${r.env==='test'?'[CHẠY THỬ]':''}</div></div>`).join(''):'Không tìm thấy lịch còn hiệu lực từ mã xác nhận đã lưu.';
 }catch(e){$('my-registrations').textContent=e.message;}
}
$('my-refresh').addEventListener('click',refreshMy);
await refresh();await refreshMy();setInterval(refresh,15000);
