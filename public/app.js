const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Asia/Ho_Chi_Minh';
const dateFmt = d => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
const timeFmt = d => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
const shortFmt = d => `${timeFmt(d)} ngày ${new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))}`;
const dateKey = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
// Same rule as lib/validation.js: 15-minute sessions plus a 15-minute break, so starts must be 30 minutes apart.
const MIN_START_GAP = 30 * 60 * 1000;
const GAP_MESSAGE = 'Hai ca phỏng vấn phải cách nhau ít nhất 15 phút. Vui lòng chọn ca khác.';
const tooClose = (a, b) => Math.abs(new Date(a.start_at) - new Date(b.start_at)) < MIN_START_GAP;
// picks: committee_id -> slot_id. One submission may hold one slot per committee.
let state = null, selectedCommittee = null, blocked = false;
const picks = new Map();
// Motion state: animations replay on user actions only, never on the 15-second auto refresh.
let animateSlots = true, justPicked = null, lastPicked = new Set();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const replay = (el, cls) => { if (cls) el.classList.remove(cls); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; if (cls) el.classList.add(cls); };
function confetti() {
    if (reduceMotion.matches) return;
    const box = document.createElement('div'), colors = ['#f26f21', '#ffb36b', '#1f5eab', '#3fb27a', '#ffd23f'];
    box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};--dx:${Math.round(Math.random() * 160 - 80)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--t:${(1.6 + Math.random() * 1.4).toFixed(2)}s;--delay:${(Math.random() * .35).toFixed(2)}s"></i>`).join('');
    document.body.append(box); setTimeout(() => box.remove(), 3600);
}
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
// A slot clashes when it would leave less than a 15-minute break next to another committee's pick.
const clashes = s => pickedSlots().some(p => p.committee_id !== s.committee_id && tooClose(p, s));
const slotState = s => {
    const full = s.registered >= s.capacity, past = new Date(s.start_at) <= Date.now(), clash = clashes(s);
    const unavailable = !s.open || full || past || !state.settings.registration_open;
    return { full, past, clash, unavailable, off: unavailable || clash, left: Math.max(s.capacity - s.registered, 0) };
};
function feedback(text, cls = 'error') { $('feedback').className = 'feedback ' + cls; $('feedback').textContent = text; if (text) replay($('feedback')); }
const slotAlert = text => { $('slot-alert').textContent = text; if (text) replay($('slot-alert')); };
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
        ? `<ul class="sel-list">${chosen.map(s => `<li${lastPicked.has(s.id) ? '' : ' class="new"'}><div><div class="sel-committee">${esc(committeeName(s.committee_id))}</div><div class="sel-date">${esc(dateFmt(s.start_at))}</div></div><span class="sel-time">${esc(timeFmt(s.start_at))}</span><button type="button" class="sel-remove" data-unpick="${s.committee_id}" aria-label="Bỏ chọn ${esc(committeeName(s.committee_id))}">×</button></li>`).join('')}</ul>`
        : 'Chưa chọn ca. Chọn một ca còn chỗ ở mỗi ban bạn muốn ứng tuyển (bước 1).';
    lastPicked = new Set(chosen.map(s => s.id));
    $('summary').classList.toggle('filled', chosen.length > 0);
    if (chosen.length) $('summary').classList.remove('missing');
    // Stays clickable without a pick so the submit handler can explain what is missing.
    $('submit-btn').disabled = !state?.settings.registration_open || blocked;
    $('submit-btn').classList.toggle('loading', blocked);
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
    let n = 0;
    $('slots').classList.toggle('enter', animateSlots); animateSlots = false;
    if (slots.length) $('slots').innerHTML = Object.entries(grouped).map(([date, group]) => `<div class="date-title">${esc(dateFmt(group[0].start_at))} <small>${group.length} ca</small></div><div class="slots-grid">${group.map(s => {
        const { full, past, clash, unavailable, off, left } = slotState(s), selected = picks.get(s.committee_id) === s.id, low = !off && left <= 2;
        const status = past ? 'Đã qua' : !s.open ? 'Đã khóa' : full ? 'Hết chỗ' : clash ? 'Chưa đủ 15 phút nghỉ' : `Còn ${left}/${s.capacity} chỗ`;
        // Clashing slots stay clickable so the click can explain the break rule.
        return `<button style="--i:${Math.min(n++, 24)}" class="slot${selected ? ' selected' : ''}${s.id === justPicked ? ' just' : ''}${full ? ' full' : ''}${low ? ' low' : ''}${clash && !unavailable ? ' clash' : ''}" data-slot="${s.id}" aria-pressed="${selected}"${clash && !unavailable ? ' aria-disabled="true"' : ''} ${unavailable && !selected ? 'disabled' : ''}><span class="slot-time">${esc(timeFmt(s.start_at))}</span><span class="slot-meta">${status}</span><span class="seats" aria-hidden="true"><i style="width:${left / s.capacity * 100}%"></i></span></button>`;
    }).join('')}</div>`).join('');
    else $('slots').innerHTML = '<div class="empty">Chưa có lịch cho ban này.<br>BTC sẽ cập nhật khi có ca phỏng vấn.</div>';
    justPicked = null;
    selectedText();
    $('refresh-info').textContent = 'Đồng bộ tự động mỗi 15 giây • Cập nhật: ' + new Date().toLocaleTimeString('vi-VN');
}
$('committee-tabs').addEventListener('click', e => { const b = e.target.closest('[data-committee]'); if (!b) return; selectedCommittee = Number(b.dataset.committee); animateSlots = true; slotAlert(''); render(); });
$('slots').addEventListener('click', e => {
    const b = e.target.closest('[data-slot]'); if (!b) return;
    const s = slotById(Number(b.dataset.slot)); if (!s) return;
    if (picks.get(s.committee_id) === s.id) picks.delete(s.committee_id);
    else if (clashes(s)) { slotAlert(GAP_MESSAGE); replay(b, 'shake'); return; }
    else { picks.set(s.committee_id, s.id); justPicked = s.id; }
    slotAlert(''); feedback('', ''); render();
});
$('selected-slot').addEventListener('click', e => { const b = e.target.closest('[data-unpick]'); if (!b) return; picks.delete(Number(b.dataset.unpick)); slotAlert(''); render(); });
async function refresh() {
    try {
        state = await api('public');
        // slots.id is a Postgres bigint, which arrives as a string; picks and lookups use numbers.
        state.slots = state.slots.map(s => ({ ...s, id: Number(s.id), committee_id: Number(s.committee_id) }));
        prunePicks(); render();
    } catch (e) { setNotice(e.message, 'error'); }
}
$('refresh').addEventListener('click', refresh);
$('registration-form').addEventListener('submit', async e => {
    e.preventDefault(); if (blocked) return;
    if (!pickedSlots().length) {
        feedback('Bạn chưa chọn ca phỏng vấn. Hãy chọn ít nhất một ca còn chỗ ở bước 1 trước khi gửi đăng ký.');
        replay($('summary'), 'missing');
        $('booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    const chosen = pickedSlots();
    if (chosen.some((a, i) => chosen.slice(i + 1).some(b => tooClose(a, b)))) { feedback(GAP_MESSAGE); return; }
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
        confetti(); picks.clear(); await refresh(); await refreshMy();
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
addEventListener('scroll', () => $('topbar').classList.toggle('scrolled', scrollY > 4), { passive: true });
$('student-id').addEventListener('input', e => { const el = e.target, pos = el.selectionStart; el.value = el.value.toUpperCase(); el.setSelectionRange(pos, pos); });
new IntersectionObserver(([entry]) => { formVisible = entry.isIntersecting; updateBar(); }).observe($('registration-form'));
$('mobile-bar-go').addEventListener('click', () => { $('form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('full-name').focus({ preventScroll: true }); });
await refresh(); await refreshMy(); setInterval(refresh, 15000);
