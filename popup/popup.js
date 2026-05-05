// popup/popup.js

function msg(type, data = {}) {
    return chrome.runtime.sendMessage({ type, ...data });
}

let toastTimer = null;
function showToast(text, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

function downloadJson(json, filename) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function formatDomain(domain) {
    return domain.replace('chatgpt.com', 'ChatGPT').replace('claude.ai', 'Claude');
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'just now';
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── State ──
let currentDomain = '';
let profiles = [];
let selectedIds = new Set();
let activeProfileId = null; // profil yang sedang aktif dipakai

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
    await detectDomain();
    await loadActiveProfile();
    await loadProfiles();
    bindEvents();
});

async function detectDomain() {
    try {
        const res = await msg('GET_ACTIVE_TAB_DOMAIN');
        if (res.ok) {
            currentDomain = res.domain;
            document.getElementById('activeDomain').textContent = currentDomain;
            document.getElementById('domainBadge').textContent = currentDomain;
            document.querySelectorAll('.sa-btn').forEach(btn => {
                btn.classList.toggle('active-sa', btn.dataset.domain === currentDomain);
            });
        }
    } catch (e) {}
}

async function loadActiveProfile() {
    const data = await chrome.storage.local.get('activeProfile');
    // activeProfile disimpan per domain: { 'claude.ai': id, 'chatgpt.com': id }
    const map = data.activeProfile || {};
    activeProfileId = map[currentDomain] || null;
}

async function loadProfiles() {
    const res = await msg('GET_ALL');
    profiles = res.profiles || [];

    // Filter berdasarkan domain aktif
    const filtered = currentDomain
        ? profiles.filter(p => p.domain === currentDomain)
        : profiles;

    document.getElementById('profileCount').textContent = filtered.length;
    renderProfiles(filtered);
}

function renderProfiles(list) {
    const container = document.getElementById('profilesList');
    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">◌</div>
                <div class="empty-text">Belum ada profil untuk ${formatDomain(currentDomain) || 'domain ini'}</div>
            </div>`;
        return;
    }

    container.innerHTML = '';
    for (const p of list) {
        const isActive = p.id === activeProfileId;
        const item = document.createElement('div');
        item.className = `profile-item${selectedIds.has(p.id) ? ' selected' : ''}${isActive ? ' is-active' : ''}`;
        item.dataset.id = p.id;

        const validityClass = p.validity === true  ? 'validity-valid'   :
                              p.validity === false ? 'validity-expired' : 'validity-unknown';
        const validityText  = p.validity === true  ? '✓ valid'   :
                              p.validity === false ? '✗ expired' : '? unknown';

        item.innerHTML = `
            <input type="checkbox" class="profile-checkbox" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''} />
            <div class="profile-info">
                <div class="profile-label-row">
                    <div class="profile-label">${escapeHtml(p.label)}</div>
                    ${isActive ? '<span class="badge-active">● ACTIVE</span>' : ''}
                </div>
                <div class="profile-meta">
                    <span class="profile-domain">${formatDomain(p.domain)}</span>
                    <span class="profile-validity ${validityClass}">${validityText}</span>
                    <span class="profile-domain">${timeAgo(p.capturedAt)}</span>
                </div>
            </div>
            <div class="profile-actions">
                <button class="btn-swap" data-id="${p.id}">${isActive ? 'RE-SWAP' : 'SWAP'}</button>
                <button class="btn-delete" data-id="${p.id}">✕</button>
            </div>
        `;
        container.appendChild(item);
    }

    container.querySelectorAll('.btn-swap').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); handleSwap(btn.dataset.id); });
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); handleDelete(btn.dataset.id); });
    });
    container.querySelectorAll('.profile-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            if (cb.checked) selectedIds.add(cb.dataset.id);
            else selectedIds.delete(cb.dataset.id);
            const filtered = currentDomain ? profiles.filter(p => p.domain === currentDomain) : profiles;
            renderProfiles(filtered);
        });
    });
}

// ── Events ──
function bindEvents() {
    document.querySelectorAll('.sa-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentDomain = btn.dataset.domain;
            document.getElementById('activeDomain').textContent = currentDomain;
            document.getElementById('domainBadge').textContent = currentDomain;
            document.querySelectorAll('.sa-btn').forEach(b => b.classList.remove('active-sa'));
            btn.classList.add('active-sa');
            await loadActiveProfile();
            await loadProfiles();
        });
    });

    document.getElementById('btnCapture').addEventListener('click', handleCapture);
    document.getElementById('labelInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleCapture();
    });

    document.getElementById('btnExportAll').addEventListener('click', async () => {
        const res = await msg('EXPORT_ALL');
        if (res.ok) { downloadJson(res.json, `sesh-swapper-all-${Date.now()}.json`); showToast('Export berhasil!', 'success'); }
    });

    document.getElementById('btnExportPick').addEventListener('click', async () => {
        if (selectedIds.size === 0) { showToast('Pilih profil dulu!', 'error'); return; }
        const res = await msg('EXPORT_PICK', { ids: [...selectedIds] });
        if (res.ok) { downloadJson(res.json, `sesh-swapper-pick-${Date.now()}.json`); showToast(`Export ${selectedIds.size} profil!`, 'success'); }
    });

    document.getElementById('btnImport').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const res = await msg('IMPORT_MERGE', { json: text });
            if (res.ok) { showToast(`Import ${res.count} profil baru!`, 'success'); await loadProfiles(); }
        } catch { showToast('File tidak valid!', 'error'); }
        e.target.value = '';
    });
}

// ── Handlers ──
async function handleCapture() {
    const label = document.getElementById('labelInput').value.trim();
    if (!label) { showToast('Isi label dulu!', 'error'); document.getElementById('labelInput').focus(); return; }
    if (!currentDomain) { showToast('Domain tidak terdeteksi', 'error'); return; }

    const btn = document.getElementById('btnCapture');
    btn.textContent = 'Capturing...';
    btn.disabled = true;

    try {
        const res = await msg('CAPTURE', { domain: currentDomain, label });
        if (res.ok) {
            document.getElementById('labelInput').value = '';
            showToast(`✓ "${label}" tersimpan!`, 'success');
            await loadProfiles();
            checkValidity(res.profile.id, currentDomain);
        } else {
            showToast('Gagal capture!', 'error');
        }
    } finally {
        btn.innerHTML = '<span class="btn-capture-icon">⊕</span> Capture Session';
        btn.disabled = false;
    }
}

async function handleSwap(id) {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    const btn = document.querySelector(`.btn-swap[data-id="${id}"]`);
    if (btn) { btn.textContent = '...'; btn.disabled = true; }

    try {
        const res = await msg('SWAP', { id });
        if (res.ok) {
            // Simpan sebagai active profile untuk domain ini
            const data = await chrome.storage.local.get('activeProfile');
            const map = data.activeProfile || {};
            map[profile.domain] = id;
            await chrome.storage.local.set({ activeProfile: map });
            activeProfileId = id;

            showToast(`✓ Swap ke "${profile.label}"`, 'success');

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.url?.includes(res.domain)) {
                chrome.tabs.reload(tabs[0].id);
            }

            await loadProfiles();
        } else {
            showToast('Swap gagal!', 'error');
        }
    } finally {
        if (btn) { btn.textContent = 'SWAP'; btn.disabled = false; }
    }
}

async function handleDelete(id) {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    // Hapus dari active juga kalau ini yang aktif
    if (activeProfileId === id) {
        const data = await chrome.storage.local.get('activeProfile');
        const map = data.activeProfile || {};
        delete map[profile.domain];
        await chrome.storage.local.set({ activeProfile: map });
        activeProfileId = null;
    }

    const res = await msg('DELETE', { id });
    if (res.ok) {
        selectedIds.delete(id);
        showToast(`"${profile.label}" dihapus`, 'info');
        await loadProfiles();
    }
}

async function checkValidity(id, domain) {
    const res = await msg('CHECK_VALIDITY', { domain });
    if (res.ok) {
        await chrome.runtime.sendMessage({ type: 'UPDATE_VALIDITY', id, valid: res.valid });
        await loadProfiles();
    }
}
