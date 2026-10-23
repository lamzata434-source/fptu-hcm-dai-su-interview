const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Asia/Ho_Chi_Minh';
const dateFmt = d => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
const timeFmt = d => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
const shortFmt = d => `${timeFmt(d)} ngày ${new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))}`;
const dateKey = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const GAP = 15 * 60 * 1000;
// picks: committee_id -> slot_id. One submission may hold one slot per committee.
let state = null, selectedCommittee = null, blocked = false;
const picks = new Map();
const tokensKey = 'fptu_dai_su_registration_tokens_v1';
async function api(path, method = 'GET', data) {
    const opts = { method, headers: {} };
    if (data !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    const r = await fetch('/api/' + path, opts), json = await r.json().catch(() => ({ error: 'Không đọc được phản hồi máy chủ' }));
    if (!r.ok) throw new Error(json.error || 'Yêu cầu thất bại'); return json;
}
function setNotice(text, kind = '') { $('notice-text').textContent = text; $('notice').className = 'notice' + (kind ? ' ' + kind : ''); }
let formVisible = false;
const updateBar = () => $('mobile-bar').classList.toggle('show', picks.size > 0 && !formVisible);
const slotById = id => state?.slots.find(x => x.id === id);
const committeeName = id => state?.committees.find(x => x.id === id)?.name || 'Ban';
const pickedSlots = () => [...picks.values()].map(slotById).filter(Boolean).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
// A slot clashes when another committee's pick starts less than 15 minutes away.
const clashes = s => pickedSlots().some(p => p.committee_id !== s.committee_id && Math.abs(new Date(p.start_at) - new Date(s.start_at)) < GAP);
const slotState = s => {
    const full = s.registered >= s.capacity, past = new Date(s.start_at) <= Date.now(), clash = clashes(s);
    return { full, past, clash, off: !s.open || full || past || clash || !state.settings.registration_open, left: Math.max(s.capacity - s.registered, 0) };
};
function feedback(text, cls = 'error') { $('feedback').className = 'feedback ' + cls; $('feedback').textContent = text; }
function windowNotice() {
    const s = state.settings;
    if (s.registration_state === 'not_yet') return `Đăng ký sẽ mở lúc ${shortFmt(s.registration_opens_at)}.`;
    if (s.registration_state === 'ended') return 'Đăng ký đã kết thúc.';
    if (!s.registration_open) return 'Hiện chưa mở nhận đăng ký.';
    return s.registration_closes_at ? `Đăng ký đóng lúc ${shortFmt(s.registration_closes_at)}.` : '';
}
function selectedText() {
    const chosen = pickedSlots();
    $('selected-slot').innerHTML = chosen.length
        ? `<ul class="sel-list">${chosen.map(s => `<li><div><div class="sel-committee">${esc(committeeName(s.committee_id))}</div><div class="sel-date">${esc(dateFmt(s.start_at))}</div></div><span class="sel-time">${esc(timeFmt(s.start_at))}</span><button type="button" class="sel-remove" data-unpick="${s.committee_id}" aria-label="Bỏ chọn ${esc(committeeName(s.committee_id))}">×</button></li>`).join('')}</ul>`
        : 'Chưa chọn ca. Chọn một ca còn chỗ ở mỗi ban bạn muốn ứng tuyển (bước 1).';
    $('summary').classList.toggle('filled', chosen.length > 0);
    $('submit-btn').disabled = !chosen.length || !state?.settings.registration_open || blocked;
    $('submit-label').textContent = blocked ? 'Đang gửi đăng ký…' : chosen.length > 1 ? `Gửi đăng ký ${chosen.length} ban` : 'Gửi đăng ký';
    $('mobile-bar-text').textContent = chosen.map(s => `${committeeName(s.committee_id)} ${timeFmt(s.start_at)}`).join(' • ');
    updateBar();
}
// Drops picks that are no longer bookable (full, locked, past) and tells the student to choose again.
function prunePicks() {
    const dropped = [];
    for (const [cid, id] of picks) {
        const s = slotById(id);
        if (!s || s.registered >= s.capacity || !s.open || new Date(s.start_at) <= Date.now()) { picks.delete(cid); dropped.push(s ? `${committeeName(cid)} ${timeFmt(s.start_at)}` : committeeName(cid)); }
    }
    if (dropped.length) feedback(`Ca ${dropped.join(', ')} vừa hết chỗ hoặc không còn nhận đăng ký. Vui lòng chọn ca khác còn trống.`, 'error');
}
function render() {
    if (!state) return;
    const test = state.settings.active_env === 'test', open = state.settings.registration_open, extra = windowNotice();
    $('environment-badge').textContent = test ? 'Môi trường chạy thử' : 'Đăng ký chính thức';
    $('environment-badge').className = 'pill env ' + (test ? 'env-test' : 'env-live');
    setNotice(state.settings.notice + (extra ? ' ' + extra : ''), open ? '' : 'warn');
    if (!state.committees.some(x => x.id === selectedCommittee)) selectedCommittee = state.committees[0]?.id ?? null;
    $('committee-tabs').innerHTML = state.committees.map(c => {
        const picked = slotById(picks.get(c.id)), free = state.slots.filter(s => s.committee_id === c.id && !slotState(s).off).length;
        const sub = picked ? `✓ Đã chọn ${timeFmt(picked.start_at)}` : free ? `${free} ca còn chỗ` : 'Không còn ca trống';
        return `<button class="tab ${c.id === selectedCommittee ? 'active' : ''}${picked ? ' picked' : ''}" data-committee="${c.id}" role="tab" aria-selected="${c.id === selectedCommittee}"><span>${esc(c.name)}</span><small>${sub}</small></button>`;
    }).join('');
    const slots = state.slots.filter(x => x.committee_id === selectedCommittee), grouped = Object.groupBy ? Object.groupBy(slots, x => dateKey(x.start_at)) : slots.reduce((g, s) => ((g[dateKey(s.start_at)] ??= []).push(s), g), {});
    if (!slots.length) { $('slots').innerHTML = '<div class="empty">Chưa có lịch cho ban này.<br>BTC sẽ cập nhật khi có ca phỏng vấn.</div>'; }
    else $('slots').innerHTML = Object.entries(grouped).map(([date, group]) => `<div class="date-title">${esc(dateFmt(group[0].start_at))} <small>${group.length} ca</small></div><div class="slots-grid">${group.map(s => {
        const { full, past, clash, off, left } = slotState(s), selected = picks.get(s.committee_id) === s.id, low = !off && left <= 2;
        const status = past ? 'Đã qua' : !s.open ? 'Đã khóa' : full ? 'Hết chỗ' : clash ? 'Trùng giờ ca đã chọn' : `Còn ${left}/${s.capacity} chỗ`;
        return `<button class="slot${selected ? ' selected' : ''}${full ? ' full' : ''}${low ? ' low' : ''}${clash && !full ? ' clash' : ''}" data-slot="${s.id}" aria-pressed="${selected}" ${off && !selected ? 'disabled' : ''}><span class="slot-time">${esc(timeFmt(s.start_at))}</span><span class="slot-meta">${status}</span><span class="seats" aria-hidden="true"><i style="width:${left / s.capacity * 100}%"></i></span></button>`;
    }).join('')}</div>`).join('');
    selectedText();
    $('refresh-info').textContent = 'Đồng bộ tự động mỗi 15 giây • Cập nhật: ' + new Date().toLocaleTimeString('vi-VN');
}
$('committee-tabs').addEventListener('click', e => { const b = e.target.closest('[data-committee]'); if (!b) return; selectedCommittee = Number(b.dataset.committee); render(); });
$('slots').addEventListener('click', e => {
    const b = e.target.closest('[data-slot]'); if (!b) return;
    const s = slotById(Number(b.dataset.slot)); if (!s) return;
    if (picks.get(s.committee_id) === s.id) picks.delete(s.committee_id); else picks.set(s.committee_id, s.id);
    feedback('', ''); render();
});
$('selected-slot').addEventListener('click', e => { const b = e.target.closest('[data-unpick]'); if (!b) return; picks.delete(Number(b.dataset.unpick)); render(); });
async function refresh() { try { state = await api('public'); prunePicks(); render(); } catch (e) { setNotice(e.message, 'error'); } }
$('refresh').addEventListener('click', refresh);
$('registration-form').addEventListener('submit', async e => {
    e.preventDefault(); if (blocked || !picks.size) return;
    const name = $('full-name').value.replace(/\s+/g, ' ').trim(), mssv = $('student-id').value.trim().toUpperCase();
    if (!/^[A-Z]{2}\d{6}$/.test(mssv)) { feedback('MSSV không hợp lệ: gồm 2 chữ cái in hoa và 6 chữ số, ví dụ SE170001.'); $('student-id').focus(); return; }
    // Last chance to catch a typo: once sent, the MSSV is locked and only Admin can fix it.
    const list = pickedSlots().map(s => `• ${committeeName(s.committee_id)}: ${timeFmt(s.start_at)} ${dateFmt(s.start_at)}`).join('\n');
    if (!confirm(`Kiểm tra lại trước khi gửi:\n\nHọ tên: ${name}\nMSSV: ${mssv}\n${list}\n\nSau khi gửi, bạn KHÔNG thể tự sửa MSSV, đổi hoặc hủy ca. Xác nhận gửi?`)) return;
    blocked = true; selectedText(); feedback('Đang gửi đăng ký…', '');
    try {
        const data = await api('register', 'POST', { student_name: $('full-name').value, student_id: $('student-id').value, slot_ids: pickedSlots().map(s => s.id) });
        const existing = JSON.parse(localStorage.getItem(tokensKey) || '[]'); existing.push(...data.registrations.map(r => r.lookup_token));
        localStorage.setItem(tokensKey, JSON.stringify([...new Set(existing)]));
        feedback(`Đăng ký thành công: ${data.registrations.map(r => `${r.committee_name} lúc ${timeFmt(r.start_at)}`).join(', ')}. Lịch đã lưu trên thiết bị này. MSSV ${data.registrations[0].student_id} đã dùng lượt đăng ký; nếu cần thay đổi hoặc đăng ký thêm, vui lòng liên hệ Admin.`, 'success');
        picks.clear(); await refresh(); await refreshMy();
    } catch (err) {
        feedback(err.message, 'error');
        await refresh();
    }
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
