const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Asia/Ho_Chi_Minh';
const dateFmt = d => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
const timeFmt = d => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
const dateKey = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
let state = null, selectedCommittee = null, selectedSlot = null, blocked = false;
const tokensKey = 'fptu_dai_su_registration_tokens_v1';
async function api(path, method = 'GET', data) {
    const opts = { method, headers: {} };
    if (data !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    const r = await fetch('/api/' + path, opts), json = await r.json().catch(() => ({ error: 'Không đọc được phản hồi máy chủ' }));
    if (!r.ok) throw new Error(json.error || 'Yêu cầu thất bại'); return json;
}
function setNotice(text, kind = '') { $('notice-text').textContent = text; $('notice').className = 'notice' + (kind ? ' ' + kind : ''); }
let formVisible = false;
const updateBar = () => $('mobile-bar').classList.toggle('show', !!$('mobile-bar-text').textContent && !formVisible);
const slotState = s => {
    const full = s.registered >= s.capacity, past = new Date(s.start_at) <= Date.now();
    return { full, past, off: !s.open || full || past || !state.settings.registration_open, left: Math.max(s.capacity - s.registered, 0) };
};
function feedback(text, cls = 'error') { $('feedback').className = 'feedback ' + cls; $('feedback').textContent = text; }
function selectedText() {
    const slot = state?.slots.find(x => String(x.id) === String(selectedSlot));
    const ban = state?.committees.find(x => x.id === slot?.committee_id);
    $('selected-slot').innerHTML = slot ? `<div class="sel-committee">${esc(ban?.name || 'Ban')}</div><div class="sel-time">${esc(timeFmt(slot.start_at))}</div><div class="sel-date">${esc(dateFmt(slot.start_at))}</div>` : 'Chưa chọn ca. Hãy chọn một ca còn chỗ ở bước 1.';
    $('summary').classList.toggle('filled', !!slot);
    $('submit-btn').disabled = !slot || !state?.settings.registration_open || !slot.open || slot.registered >= slot.capacity || new Date(slot.start_at) <= Date.now() || blocked;
    $('submit-label').textContent = blocked ? 'Đang xác nhận…' : 'Xác nhận đăng ký';
    $('mobile-bar-text').textContent = slot ? `${ban?.name || 'Ban'} • ${timeFmt(slot.start_at)}` : '';
    updateBar();
}
function render() {
    if (!state) return;
    const test = state.settings.active_env === 'test', open = state.settings.registration_open;
    $('environment-badge').textContent = test ? 'Môi trường chạy thử' : 'Đăng ký chính thức';
    $('environment-badge').className = 'pill env ' + (test ? 'env-test' : 'env-live');
    setNotice(state.settings.notice + (open ? '' : ' Hiện chưa mở nhận đăng ký.'), open ? '' : 'warn');
    if (!state.committees.some(x => x.id === selectedCommittee)) selectedCommittee = state.committees[0]?.id ?? null;
    $('committee-tabs').innerHTML = state.committees.map(c => {
        const free = state.slots.filter(s => s.committee_id === c.id && !slotState(s).off).length;
        return `<button class="tab ${c.id === selectedCommittee ? 'active' : ''}" data-committee="${c.id}" role="tab" aria-selected="${c.id === selectedCommittee}"><span>${esc(c.name)}</span><small>${free ? `${free} ca còn chỗ` : 'Không còn ca trống'}</small></button>`;
    }).join('');
    const slots = state.slots.filter(x => x.committee_id === selectedCommittee), grouped = Object.groupBy ? Object.groupBy(slots, x => dateKey(x.start_at)) : slots.reduce((g, s) => ((g[dateKey(s.start_at)] ??= []).push(s), g), {});
    if (!slots.length) { $('slots').innerHTML = '<div class="empty">Chưa có lịch cho ban này.<br>BTC sẽ cập nhật khi có ca phỏng vấn.</div>'; }
    else $('slots').innerHTML = Object.entries(grouped).map(([date, group]) => `<div class="date-title">${esc(dateFmt(group[0].start_at))} <small>${group.length} ca</small></div><div class="slots-grid">${group.map(s => {
        const { full, past, off, left } = slotState(s), selected = String(selectedSlot) === String(s.id), low = !off && left <= 2;
        const status = past ? 'Đã qua' : !s.open ? 'Đã khóa' : full ? 'Hết chỗ' : `Còn ${left}/${s.capacity} chỗ`;
        return `<button class="slot${selected ? ' selected' : ''}${full ? ' full' : ''}${low ? ' low' : ''}" data-slot="${s.id}" aria-pressed="${selected}" ${off ? 'disabled' : ''}><span class="slot-time">${esc(timeFmt(s.start_at))}</span><span class="slot-meta">${status}</span><span class="seats" aria-hidden="true"><i style="width:${left / s.capacity * 100}%"></i></span></button>`;
    }).join('')}</div>`).join('');
    selectedText();
    $('refresh-info').textContent = 'Đồng bộ tự động mỗi 15 giây • Cập nhật: ' + new Date().toLocaleTimeString('vi-VN');
}
$('committee-tabs').addEventListener('click', e => { const b = e.target.closest('[data-committee]'); if (!b) return; selectedCommittee = Number(b.dataset.committee); render(); });
$('slots').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (!b) return; selectedSlot = Number(b.dataset.slot); feedback('', ''); render(); });
async function refresh() { try { state = await api('public'); render(); } catch (e) { setNotice(e.message, 'error'); } }
$('refresh').addEventListener('click', refresh);
$('registration-form').addEventListener('submit', async e => {
    e.preventDefault(); if (blocked || !selectedSlot) return;
    blocked = true; selectedText(); feedback('Đang xác nhận đăng ký…', '');
    try {
        const data = await api('register', 'POST', { student_name: $('full-name').value, student_id: $('student-id').value, slot_id: selectedSlot });
        const existing = JSON.parse(localStorage.getItem(tokensKey) || '[]'); existing.push(data.registration.lookup_token);
        localStorage.setItem(tokensKey, JSON.stringify([...new Set(existing)]));
        feedback(`Đăng ký thành công! ${data.registration.committee_name} lúc ${timeFmt(data.registration.start_at)}. Lịch đã lưu trên thiết bị này.`, 'success');
        selectedSlot = null; await refresh(); await refreshMy();
    } catch (err) { feedback(err.message, 'error'); await refresh(); }
    finally { blocked = false; selectedText(); }
});
async function refreshMy() {
    let tokens = []; try { tokens = JSON.parse(localStorage.getItem(tokensKey) || '[]'); } catch { }
    if (!Array.isArray(tokens) || !tokens.length) { $('my-registrations').textContent = 'Chưa có lịch được lưu trên thiết bị này.'; return; }
    try {
        const { registrations } = await api('my', 'POST', { tokens });
        $('my-registrations').innerHTML = registrations.length ? `<div class="my-list">${registrations.map(r => `<article class="ticket"><div class="ticket-head"><b>${esc(r.committee_name)}</b>${r.env === 'test' ? '<span class="badge">Chạy thử</span>' : ''}</div><div class="ticket-time">${esc(timeFmt(r.start_at))}</div><div class="ticket-date">${esc(dateFmt(r.start_at))}</div><div class="ticket-who">${esc(r.student_name)} · ${esc(r.student_id)}</div></article>`).join('')}</div>` : 'Không tìm thấy lịch còn hiệu lực từ mã xác nhận đã lưu.';
    } catch (e) { $('my-registrations').textContent = e.message; }
}
$('my-refresh').addEventListener('click', refreshMy);
$('student-id').addEventListener('input', e => { const el = e.target, pos = el.selectionStart; el.value = el.value.toUpperCase(); el.setSelectionRange(pos, pos); });
new IntersectionObserver(([entry]) => { formVisible = entry.isIntersecting; updateBar(); }).observe($('registration-form'));
$('mobile-bar-go').addEventListener('click', () => { $('form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('full-name').focus({ preventScroll: true }); });
await refresh(); await refreshMy(); setInterval(refresh, 15000);
