// background/service-worker.js

import { getAllProfiles, saveProfile, deleteProfile, updateProfile, exportAllProfiles, exportPickedProfiles, importAndMerge } from '../utils/storage.js';

// ── Capture semua cookies dari domain ──
async function captureCookies(domain) {
    const url = `https://${domain}`;
    const cookies = await chrome.cookies.getAll({ domain });
    return cookies;
}

// ── Hapus semua cookies dari domain ──
async function clearCookies(domain) {
    const cookies = await chrome.cookies.getAll({ domain });
    for (const cookie of cookies) {
        const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`;
        await chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
    }
}

// ── Tulis cookies ke browser ──
async function writeCookies(cookies) {
    for (const cookie of cookies) {
        const details = {
            url: `http${cookie.secure ? 's' : ''}://${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`,
            name: cookie.name,
            value: cookie.value,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite,
        };
        if (cookie.expirationDate) details.expirationDate = cookie.expirationDate;
        if (!cookie.hostOnly) details.domain = cookie.domain;
        try {
            await chrome.cookies.set(details);
        } catch (e) {
            console.warn('[SessionSwapper] Gagal set cookie:', cookie.name, e.message);
        }
    }
}

// ── Cek validitas session dengan ping ──
async function checkSessionValidity(domain) {
    const testUrls = {
        'claude.ai': 'https://claude.ai/api/auth/session',
        'chat.openai.com': 'https://chat.openai.com/api/auth/session',
    };
    const url = testUrls[domain] || `https://${domain}`;
    try {
        const resp = await fetch(url, { credentials: 'include' });
        return resp.status === 200;
    } catch {
        return false;
    }
}

// ── Handler pesan dari popup ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handleMessage(msg).then(sendResponse).catch(err => {
        console.error('[SessionSwapper] Error:', err);
        sendResponse({ ok: false, error: err.message });
    });
    return true; // async
});

async function handleMessage(msg) {
    switch (msg.type) {

        case 'CAPTURE': {
            const cookies = await captureCookies(msg.domain);
            const profile = {
                id: crypto.randomUUID(),
                label: msg.label,
                domain: msg.domain,
                cookies,
                capturedAt: Date.now(),
            };
            await saveProfile(profile);
            return { ok: true, profile };
        }

        case 'SWAP': {
            const profiles = await getAllProfiles();
            const profile = profiles.find(p => p.id === msg.id);
            if (!profile) return { ok: false, error: 'Profil tidak ditemukan' };
            await clearCookies(profile.domain);
            await writeCookies(profile.cookies);
            return { ok: true, domain: profile.domain };
        }

        case 'DELETE': {
            await deleteProfile(msg.id);
            return { ok: true };
        }

        case 'GET_ALL': {
            const profiles = await getAllProfiles();
            return { ok: true, profiles };
        }

        case 'CHECK_VALIDITY': {
            const valid = await checkSessionValidity(msg.domain);
            return { ok: true, valid };
        }

        case 'EXPORT_ALL': {
            const json = await exportAllProfiles();
            return { ok: true, json };
        }

        case 'EXPORT_PICK': {
            const json = await exportPickedProfiles(msg.ids);
            return { ok: true, json };
        }

        case 'IMPORT_MERGE': {
            const count = await importAndMerge(msg.json);
            return { ok: true, count };
        }

        case 'UPDATE_VALIDITY': {
            await updateProfile(msg.id, { validity: msg.valid });
            return { ok: true };
        }

        case 'GET_ACTIVE_TAB_DOMAIN': {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url) return { ok: false };
            const url = new URL(tab.url);
            return { ok: true, domain: url.hostname };
        }

        default:
            return { ok: false, error: 'Unknown message type' };
    }
}
