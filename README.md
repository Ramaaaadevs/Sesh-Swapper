# ⇄ Sesh Swapper

Extension browser berbasis Chromium untuk menyimpan, menukar, dan mengelola session cookies dari berbagai akun tanpa perlu berbagi password.

Dibuat untuk Brave (Manifest V3).

---

## Apa yang Bisa Dilakukan

Sesh Swapper menangkap cookies session login kamu dan memungkinkan kamu berpindah antara beberapa akun di situs yang sama secara instan. Berguna untuk mengelola akun AI bersama (Claude, ChatGPT) atau workflow multi-akun lainnya.

Tidak ada password yang terlibat yaitu hanya session token.

---

## Fitur

- **Capture Session** : simpan session login saat ini dengan label kustom
- **Swap** : langsung pindah ke session yang tersimpan dan reload tab
- **Indikator Aktif** : menampilkan profil mana yang sedang aktif (badge ● ACTIVE)
- **Filter per Domain** : profil Claude dan GPT ditampilkan secara terpisah
- **Cek Validitas** : otomatis mengecek apakah session masih valid setelah di-capture
- **Export / Import** : backup dan bagikan profil sebagai file JSON
- **Delete** : hapus profil yang tersimpan

Domain yang didukung secara bawaan:
- `claude.ai`
- `chatgpt.com`

---

## Instalasi

> Extension ini tidak dipublikasikan ke Chrome Web Store. Load secara manual sebagai unpacked extension.

1. Clone atau download repositori ini
2. Buka `brave://extensions` (atau `chrome://extensions`)
3. Aktifkan **Developer mode** (toggle di kanan atas)
4. Klik **Load unpacked**
5. Pilih folder `session-swapper`

Icon extension akan muncul di toolbar browser kamu.

---

## Cara Pakai

1. Login ke `claude.ai` atau `chatgpt.com`
2. Klik icon Sesh Swapper di toolbar
3. Ketik label untuk session ini (contoh: "GPT 1")
4. Klik **Capture Session**
5. Untuk ganti akun: klik **SWAP** pada profil yang tersimpan

> ⚠️ Jangan **logout** dari akun yang ingin kamu gunakan lagi. Logout akan menginvalidasi token di sisi server. Cukup tutup tab saja.

---

## Struktur File

```
session-swapper/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/
│   └── service-worker.js
├── utils/
│   └── storage.js
└── icons/
    ├── claude.png
    ├── gpt.png
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Cara Kerjanya

Setelah login, website menyimpan session token di cookies browser kamu. Sesh Swapper membaca cookies tersebut, menyimpannya secara lokal di `chrome.storage.local`, dan dapat mengembalikannya kapan saja — secara efektif mengganti akun mana yang sedang terautentikasi di browser.

Server hanya mengecek apakah token valid, bukan siapa yang menggunakannya.

---

## Privasi

Semua data disimpan **secara lokal** di browser kamu via `chrome.storage.local`. Tidak ada yang dikirim ke server eksternal mana pun. File JSON yang diekspor berisi cookies session mentah. Silahkan jaga kerahasiaannya.

---

## Pengembangan

Untuk melakukan perubahan:

1. Edit file sumber
2. Buka `brave://extensions`
3. Klik icon **refresh** (↺) pada kartu Sesh Swapper

Tidak perlu proses build.

---

## Lisensi

MIT — bebas digunakan untuk apapun.
