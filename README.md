# FLOW — Worship Slide / Presentation Server

Aplikasi worship presentation (Node.js + Express). Baca judul lagu dan Alkitab,
tampilkan ke operator/projector.

## Struktur lagu: SONGBANK (file per lagu)

- Setiap lagu disimpan sebagai **satu file JSON** di `DATA/songs/<judul>.json`
  dengan format `{ "title": "...", "lyrics": [...] }`.
- `DATA/songs/` adalah **SONGBANK** yang **DI-TRACK git** — satu repo (`flow`)
  adalah sumber songbank + kode aplikasi, sehingga lagu bisa sinkron antar PC.
- `DATA/songs.json` (file tunggal lama) **tidak dipakai lagi** dan di-ignore git
  (biarkan di disk kalau sudah ada; hapus manual kalau mau).

### Cara menambah lagu (dari PC mana pun)
1. Tambahkan file `<judul>.json` ke `DATA/songs/` (format `{title, lyrics}`), ATAU
   tambah lagu lewat UI operator (aksi save → otomatis ditulis jadi file per lagu).
2. `git add DATA/songs/<judul>.json && git commit && git push`
3. PC lain menjalankan `git pull` → lagu baru langsung tersedia.

### Struktur file
`DATA/songs/<judul>.json`:
```json
{
  "title": "Judul Lagu",
  "lyrics": [ { "type": "v", "text": "baris lirik", "newGroup": true } ]
}
```
Nama file disanitasi (karakter `\ / : * ? " < > |` dibuang). Backend membaca semua
file `.json` di folder ini saat `GET /api/songs` / `/api/search`, dan POST/PUT/DELETE
`/api/songs` menulis/mengubah/menghapus file per lagu.

## Versi aplikasi & laporan update

- Versi aplikasi ada di `SOURCE/package.json` (`version`). Naikkan saat rilis
  (contoh: `0.5.34` → `0.6.0`).
- Pesan update/release memakai format:
  **`Versi X.Y.Z (+ N lagu baru, total M lagu)`**
  - `N` = jumlah file lagu di `DATA/songs/` yang bertambah sejak versi sebelumnya.
  - `M` = total jumlah lagu (file .json di `DATA/songs/`).
- Cara hitung cepat di terminal:
  `ls DATA/songs/*.json | wc -l` (total), atau pakai `GET /api/songs` (array hasil = M).

## Menjalankan
- `cd SOURCE && npm install && npm start` (port default 80; fallback 8089).
- Operator: `http://localhost/operator`  ·  Projector: `http://localhost/projector`