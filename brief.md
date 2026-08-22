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

Detail selengkapnya di `log.md` dan `README.md`.