// utils/storage.js
// Semua operasi simpan/load profil dari chrome.storage.local

export async function getAllProfiles() {
    const data = await chrome.storage.local.get('profiles');
    return data.profiles || [];
}

export async function saveProfile(profile) {
    const profiles = await getAllProfiles();
    profiles.push(profile);
    await chrome.storage.local.set({ profiles });
}

export async function deleteProfile(id) {
    const profiles = await getAllProfiles();
    const updated = profiles.filter(p => p.id !== id);
    await chrome.storage.local.set({ profiles: updated });
}

export async function updateProfile(id, changes) {
    const profiles = await getAllProfiles();
    const updated = profiles.map(p => p.id === id ? { ...p, ...changes } : p);
    await chrome.storage.local.set({ profiles: updated });
}

export async function exportAllProfiles() {
    const profiles = await getAllProfiles();
    return JSON.stringify(profiles, null, 2);
}

export async function exportPickedProfiles(ids) {
    const profiles = await getAllProfiles();
    const picked = profiles.filter(p => ids.includes(p.id));
    return JSON.stringify(picked, null, 2);
}

export async function importAndMerge(jsonString) {
    const incoming = JSON.parse(jsonString);
    const existing = await getAllProfiles();
    const existingIds = new Set(existing.map(p => p.id));
    const merged = [...existing, ...incoming.filter(p => !existingIds.has(p.id))];
    await chrome.storage.local.set({ profiles: merged });
    return merged.length - existing.length; // jumlah yang berhasil diimport
}
