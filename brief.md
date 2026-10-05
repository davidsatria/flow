# FLOW — Brief / Ringkasan Proyek

Worship presentation server (Node.js + Express). Sumber kode utama: `SOURCE/server.node.js`.
Folder lagu & Alkitab: `DATA/`. Halaman: `SYSTEM/templates/`.

## Model data

### SONGBANK (file per lagu) — aktif sejak 0.6.0
- Lagu disimpan sebagai satu file per lagu: **`DATA/songs/<judul>.json`**.
- Format: `{ "title": "...", "lyrics": [{ type, text, newGroup }] }`.
- **`DATA/songs/` DI-TRACK git** → songbank sinkron antar PC (git add/commit/push/pull).
- `DATA/songs.json` (file tunggal) LEGACY — tidak dipakai lagi, di-ignore git.

### Update / rilis
- Versi di `SOURCE/package.json`. Naikkan saat rilis.
- Format pesan update: **`Versi X.Y.Z (+ N lagu baru, total M lagu)`**.
- `N`/`M` dihitung dari jumlah file `.json` di `DATA/songs/` (lihat README.md).

## Endpoint lagu (ringkas)
- `GET  /api/songs`      → `listSongs()` = `[{title, lyrics}]` (sort by title).
- `GET  /api/search?q=`  → cari judul/lirik + Alkitab.
- `POST /api/songs`      → membuat/menimpa file per lagu.
- `PUT  /api/songs`      → update / rename (hapus file lama kalau judul berubah).
- `DELETE /api/songs?title=` → hapus file per lagu.

## Pengamanan & akses (sejak 0.6.1)
- Aplikasi bisa jalan di port apa pun via env `PORT` (default 80). Subdomain
  publik `flow.davidsatriatunnel.online` memakai port **7070**.
- **`POST /api/shutdown` dinonaktifkan** → selalu **403 Forbidden** (publik tidak
  boleh mematikan server). Tidak ada tombol matikan di `home.html`.
- **Halaman Operator dikunci PIN `707`** (`SYSTEM/templates/operator.html`,
  gerbang `#pin-gate`; status unlock di `sessionStorage`). Halaman projector/OBS
  TIDAK dikunci.

## URL publik vs lokal (sejak 0.6.2)
- `GET /api/status` kini mengirim `publicUrl` = env `FLOW_PUBLIC_URL` (kosong
  kalau tidak diset). Halaman home memakai domain publik
  (`https://flow.davidsatriatunnel.online/...`) saat `publicUrl` tersedia, dan
  fallback ke IP lokal saat kosong.
- `SOURCE/start.bat` menyetel `FLOW_PUBLIC_URL=https://flow.davidsatriatunnel.online`
  di samping `PORT=7070`. Tanpa variabel ini (mode lokal) home tetap menampilkan
  IP lokal.

Detail selengkapnya di `log.md` dan `README.md`.