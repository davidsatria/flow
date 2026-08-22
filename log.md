# FLOW — Log Perubahan

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