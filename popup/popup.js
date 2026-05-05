// popup/popup.js

// ── Helpers ──
function msg(type, data = {}) {
    return chrome.runtime.sendMessage({ type, ...data });
}

let toastTimer = null;
function showToast(text, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('show');
    }, 2500);
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
    return domain.replace('chatgpt.com', 'ChatGPT')
                 .replace('claude.ai', 'Claude');
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

// ── State ──
let currentDomain = '';
let profiles = [];
let selectedIds = new Set();

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
    await detectDomain();
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

            // Highlight smart access button
            document.querySelectorAll('.sa-btn').forEach(btn => {
                btn.classList.toggle('active-sa', btn.dataset.domain === currentDomain);
            });
        }
    } catch (e) {
        console.warn('Domain detection failed', e);
    }
}

async function loadProfiles() {
    const res = await msg('GET_ALL');
    profiles = res.profiles || [];
    renderProfiles();
    document.getElementById('profileCount').textContent = profiles.length;
}

function renderProfiles() {
    const list = document.getElementById('profilesList');
    if (profiles.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">◌</div>
                <div class="empty-text">Belum ada profil tersimpan</div>
            </div>`;
        return;
    }

    list.innerHTML = '';
    for (const p of profiles) {
        const item = document.createElement('div');
        item.className = `profile-item${selectedIds.has(p.id) ? ' selected' : ''}`;
        item.dataset.id = p.id;

        const validityClass = p.validity === true ? 'validity-valid' :
                              p.validity === false ? 'validity-expired' : 'validity-unknown';
        const validityText = p.validity === true ? '✓ valid' :
                             p.validity === false ? '✗ expired' : '? unknown';

        item.innerHTML = `
            <input type="checkbox" class="profile-checkbox" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''} />
            <div class="profile-info">
                <div class="profile-label">${escapeHtml(p.label)}</div>
                <div class="profile-meta">
                    <span class="profile-domain">${formatDomain(p.domain)}</span>
                    <span class="profile-validity ${validityClass}">${validityText}</span>
                    <span class="profile-domain">${timeAgo(p.capturedAt)}</span>
                </div>
            </div>
            <div class="profile-actions">
                <button class="btn-swap" data-id="${p.id}">SWAP</button>
                <button class="btn-delete" data-id="${p.id}">✕</button>
            </div>
        `;
        list.appendChild(item);
    }

    // Bind events per item
    list.querySelectorAll('.btn-swap').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleSwap(btn.dataset.id);
        });
    });

    list.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDelete(btn.dataset.id);
        });
    });

    list.querySelectorAll('.profile-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            const id = cb.dataset.id;
            if (cb.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            renderProfiles();
        });
    });
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Event Bindings ──
function bindEvents() {
    // Smart Access — ganti domain target
    document.querySelectorAll('.sa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentDomain = btn.dataset.domain;
            document.getElementById('activeDomain').textContent = currentDomain;
            document.getElementById('domainBadge').textContent = currentDomain;
            document.querySelectorAll('.sa-btn').forEach(b => b.classList.remove('active-sa'));
            btn.classList.add('active-sa');
        });
    });

    // Capture
    document.getElementById('btnCapture').addEventListener('click', handleCapture);
    document.getElementById('labelInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCapture();
    });

    // Export All
    document.getElementById('btnExportAll').addEventListener('click', async () => {
        const res = await msg('EXPORT_ALL');
        if (res.ok) {
            downloadJson(res.json, `session-swapper-all-${Date.now()}.json`);
            showToast('Export berhasil!', 'success');
        }
    });

    // Export Pick
    document.getElementById('btnExportPick').addEventListener('click', async () => {
        if (selectedIds.size === 0) {
            showToast('Pilih profil dulu!', 'error');
            return;
        }
        const res = await msg('EXPORT_PICK', { ids: [...selectedIds] });
        if (res.ok) {
            downloadJson(res.json, `session-swapper-pick-${Date.now()}.json`);
            showToast(`Export ${selectedIds.size} profil berhasil!`, 'success');
        }
    });

    // Import
    document.getElementById('btnImport').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const res = await msg('IMPORT_MERGE', { json: text });
            if (res.ok) {
                showToast(`Import ${res.count} profil baru!`, 'success');
                await loadProfiles();
            }
        } catch {
            showToast('File tidak valid!', 'error');
        }
        e.target.value = '';
    });
}

// ── Handlers ──
async function handleCapture() {
    const label = document.getElementById('labelInput').value.trim();
    if (!label) {
        showToast('Isi label dulu!', 'error');
        document.getElementById('labelInput').focus();
        return;
    }
    if (!currentDomain) {
        showToast('Domain tidak terdeteksi', 'error');
        return;
    }

    const btn = document.getElementById('btnCapture');
    btn.textContent = 'Capturing...';
    btn.disabled = true;

    try {
        const res = await msg('CAPTURE', { domain: currentDomain, label });
        if (res.ok) {
            document.getElementById('labelInput').value = '';
            showToast(`✓ "${label}" tersimpan!`, 'success');
            await loadProfiles();

            // Auto-check validity
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
            showToast(`✓ Swap ke "${profile.label}"`, 'success');

            // Reload tab aktif di domain yang sama
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.url?.includes(res.domain)) {
                chrome.tabs.reload(tabs[0].id);
            }
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
        // Update validity di storage via background
        await chrome.runtime.sendMessage({ type: 'UPDATE_VALIDITY', id, valid: res.valid });
        await loadProfiles();
    }
}
