# FLOW — Log Perubahan

## [0.6.2] Home pakai URL publik saat online — 2026-08-22

Masalah: halaman home (`SYSTEM/templates/home.html`) membangun URL
operator/projector/OBS dari `data.ip` di `/api/status` (alamat lokal, contoh
`192.168.1.18:7070`). Karena Flow kini di-expose publik via
`https://flow.davidsatriatunnel.online`, home masih menampilkan alamat IP lokal.

Perbaikan:
- **`SOURCE/server.node.js`**: endpoint `GET /api/status` menambah field
  `publicUrl` = `process.env.FLOW_PUBLIC_URL || ''`. Field lain tidak berubah.
- **`SYSTEM/templates/home.html`** (`init()`): setelah fetch `/api/status`,
  `const base = data.publicUrl || ('http://' + ip + portStr);` → kalau
  `publicUrl` non-empty, operator/projector/OBS dan QR memakai domain publik;
  kalau kosong, fallback ke IP lokal seperti sebelumnya (catch block
  `window.location.origin` tetap dibiarkan).
- **`SOURCE/start.bat`**: tambah `set FLOW_PUBLIC_URL=https://flow.davidsatriatunnel.online`
  (di samping `set PORT=7070`). Mode lokal tanpa variabel ini → publicUrl kosong
  → home tetap IP lokal.

### Verifikasi
- `node --check server.node.js` lolos (SYNTAX OK).
- Uji via harness (module): `GET /api/status` dgn `FLOW_PUBLIC_URL` diset →
  `"publicUrl":"https://flow.davidsatriatunnel.online"`; tanpa variabel →
  `"publicUrl":""` (fallback IP lokal dipertahankan).
- **BELUM di-commit / di-push** (server live dipakai, menunggu ok David).

## [0.6.1] Pengamanan publik + subdomain flow.* — 2026-08-22

Konteks: Flow akan di-expose publik via subdomain `flow.davidsatriatunnel.online`
(tunnel Cloudflare) dari PC ini. Perlu pengamanan karena publik bisa akses.

### Nonaktifkan tombol matikan server (`home.html`, `server.node.js`)
- Hapus tombol **"Matikan Server"** + kotak konfirmasi `#shutdown-confirm` di
  `SYSTEM/templates/home.html` (tombol `btn-stop`, fungsi `showConfirm`/
  `hideConfirm`/`doShutdown`, CSS terkait).
- **`POST /api/shutdown` DI-NONAKTIFKAN**: kini selalu mengembalikan **403
  Forbidden** (`res.status(403)`), tidak lagi `process.exit(0)`. Publik tidak
  bisa mematikan server dari remote.

### PIN 707 di halaman Operator (`operator.html`)
- `SYSTEM/templates/operator.html` (halaman operator saja) diberi **gerbang PIN**
  (overlay `#pin-gate`, z-index tinggi) yang muncul saat `/operator`.
- PIN benar = `707`. Salah → pesan error "PIN salah. Coba lagi."; benar → overlay
  hilang.
- Status unlock disimpan di **`sessionStorage`** (`flow_op_unlocked=1`) sehingga
  tidak perlu input ulang tiap refresh dalam sesi browser.
- **HANYA operator yang dikunci.** `projector.html` & `obs.html` TIDAK diberi
  gate (layar projector/OBS/monitor dipakai tanpa operator).

### Port
- Tidak ada perubahan logika port. Server sudah support `process.env.PORT`
  (`const PORT = parseInt(process.env.PORT || '80', 10)`), jadi bisa jalan di
  port berapa pun (subdomain flow.* → port 7070).
- Catatan: `needsNetworkSetup`/`runElevatedSetup` hanya membuka firewall untuk
  port 80 & 8089. Tunnel Cloudflare (cloudflared) connect ke origin via
  localhost/local network sehingga TIDAK perlu rule firewall tambahan untuk
  7070.

### Verifikasi
- `node --check server.node.js` lolos (SYNTAX OK).
- Uji via harness (module): `POST /api/shutdown` → 403; `GET /` tidak lagi
  memuat "Matikan Server"/"shutdown" tapi tetap punya "Buka Operator"; `GET
  /operator` memuat `#pin-gate` + konstanta PIN `707`; `GET /projector` &
  `/obs` TIDAK memuat `#pin-gate`.
- Uji perilaku PIN (mock-DOM atas IIFE asli): PIN salah → tetap terkunci + pesan
  error; PIN `707` → gate hilang + `sessionStorage` ter-set; refresh dgn flag →
  gate langsung hilang.
- **BELUM di-commit / di-push** (menunggu ok David).

## [0.6.0] Migrasi backend ke SONGBANK (file per lagu) + bersihkan repo — 2026-08-22

Keputusan David: pakai **file per lagu** (`DATA/songs/<judul>.json`) sebagai sumber
lagu, HAPUS pemakaian `DATA/songs.json`. `DATA/songs/` adalah SONGBANK DI-TRACK git,
dipakai sinkron antar PC.

### Backend (`SOURCE/server.node.js`)
- Hapus `SONGS_FILE` (DATA/songs.json) → ganti `SONGS_DIR` (DATA/songs/).
- Helper baru:
  - `listSongs()` — baca semua file `.json` di `DATA/songs/` → `[{title, lyrics}]`, sort by title.
  - `getSongFile(title)` — path file = `sanitize(title)+'.json'`.
  - `findSongFile(title)` — cari file (default path, fallback cocok field `title`).
  - `sanitizeFilename()` — buang `\ / : * ? " < > |`.
- `initData()` / `migrateLegacyDataLayout()`: pastikan `SONGS_DIR` ada (mkdir recursive);
  songs.json lama TIDAK dipindah/dipakai/dihapus otomatis (di-ignore).
- `GET /api/songs` → `listSongs()`.
- `/api/search` iterasi `listSongs()`.
- `POST /api/songs` → tulis file per lagu (timpa kalau sudah ada).
- `PUT /api/songs` → rename (hapus file lama + tulis baru) / update (timpa).
- `DELETE /api/songs` → hapus file per lagu.
- Verifikasi: `node --check` lolos; startup bersih; GET 973 lagu dari folder; search;
  POST/PUT/DELETE dgn lagu dummy lalu hapus.

### Bersihkan repo
- Hapus file dev tool: `batch_convert.js`, `convert_show.js`, `merge_songs.js`,
  `check_braces.py`, `check_parens.py`, `check_parens_final.py`, `check_tags.py`,
  `check_tags_final.py`.
- `DATA/songs.json` ditambahkan ke `.gitignore` (tetap di disk, tidak di-push).
- `.gitignore` + data runtime: `DATA/schedule.json`, `DATA/saved_schedules.json`,
  `DATA/slides.json`, `DATA/last_settings.json`, `DATA/favorites_songs.json` → untracked + ignored.
- **`DATA/songs/` TIDAK di-ignore** (songbank di-track git, asumsi David untuk sinkron antar PC).
- Commit `Tak Selalu Tuhan Menjawab Doa.show` yang sudah dihapus (git D).

### Songbank & mekanisme update
- Tambah `README.md`: cara tambah lagu, struktur file per-lagu, cara sync antar PC (git pull),
  dan laporan update format `Versi X.Y.Z (+ N lagu baru, total M lagu)`.
- Bump versi `SOURCE/package.json`: `0.5.34` → `0.6.0`.
- JANGAN push dulu (David mau review setup distribusi).