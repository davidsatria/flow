const express = require('express');
const fs = require('fs');

// Global error handler to capture early crashes
process.on('uncaughtException', (err) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const root = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
    const crashLog = path.join(root, 'DATA', 'flow_crash.log');
    if (!fs.existsSync(path.dirname(crashLog))) fs.mkdirSync(path.dirname(crashLog), { recursive: true });
    fs.appendFileSync(crashLog, `[${new Date().toISOString()}] CRASH: ${err.stack || err}\n`);
  } catch (e) {}
  process.exit(1);
});
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const QRCode = require('qrcode');
const { XMLParser } = require('fast-xml-parser');
const WebSocket = require('ws');

// Rejection handler
process.on('unhandledRejection', (reason, promise) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const root = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
    const crashLog = path.join(root, 'DATA', 'flow_crash.log');
    fs.appendFileSync(crashLog, `[${new Date().toISOString()}] REJECTION: ${reason?.stack || reason}\n`);
  } catch (e) {}
});

const PORT = parseInt(process.env.PORT || '80', 10);
// Dalam pkg, __dirname = virtual snapshot (read-only). Gunakan path exe untuk akses file di disk.
// Saat development, file server berada di /SOURCE sehingga root runtime adalah parent folder.
const ROOT_DIR = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
const SYSTEM_DIR = path.join(ROOT_DIR, 'SYSTEM');
const DATA_DIR = path.join(ROOT_DIR, 'DATA');

// Re-initialize logging as early as possible
const LOG_FILE = path.join(DATA_DIR, 'flow.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}

try {
  if (!fs.existsSync(SYSTEM_DIR)) fs.mkdirSync(SYSTEM_DIR, { recursive: true });
} catch (e) {
  console.error('[Startup] Gagal buat SYSTEM_DIR:', e.message);
}

const DATA_BIBLE_DIR = path.join(DATA_DIR, 'biblelist.netlify.zefania');
const BIBLE_FILES = {
  TB: path.join(DATA_BIBLE_DIR, 'Bible_Indonesian_TB.xml'),
  BIS: path.join(DATA_BIBLE_DIR, 'Bible_Indonesian_BIS.xml'),
  NKJV: path.join(DATA_BIBLE_DIR, 'Bible_English_NKJV.xml')
};

let currentBibleFile = BIBLE_FILES.TB;
// Lagu disimpan sebagai file per lagu (DATA/songs/<judul>.json). songs.json lama TIDAK dipakai lagi
// (tetapi tidak dihapus otomatis saat runtime — user hapus manual kalau mau).
const SONGS_DIR = path.join(DATA_DIR, 'songs');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');
const SAVED_SCHED_FILE = path.join(DATA_DIR, 'saved_schedules.json');
const LAST_SETTINGS_FILE = path.join(DATA_DIR, 'last_settings.json');
const BG_DIR = path.join(DATA_DIR, 'backgrounds');
const TEMPLATE_DIR = path.join(SYSTEM_DIR, 'templates');
const FONT_DIR = path.join(SYSTEM_DIR, 'fonts');

const BOOK_MAP = {
  Genesis: 'Kejadian', Exodus: 'Keluaran', Leviticus: 'Imamat', Numbers: 'Bilangan', Deuteronomy: 'Ulangan',
  Joshua: 'Yosua', Judges: 'Hakim-hakim', Ruth: 'Rut', '1 Samuel': '1 Samuel', '2 Samuel': '2 Samuel',
  '1 Kings': '1 Raja-raja', '2 Kings': '2 Raja-raja', '1 Chronicles': '1 Tawarikh', '2 Chronicles': '2 Tawarikh',
  Ezra: 'Ezra', Nehemiah: 'Nehemia', Esther: 'Ester', Job: 'Ayub', Psalms: 'Mazmur', Psalm: 'Mazmur', Proverbs: 'Amsal',
  Ecclesiastes: 'Pengkhotbah', 'Song of Solomon': 'Kidung Agung', 'Song of Songs': 'Kidung Agung',
  Isaiah: 'Yesaya', Jeremiah: 'Yeremia', Lamentations: 'Ratapan', Ezekiel: 'Yehezkiel', Daniel: 'Daniel',
  Hosea: 'Hosea', Joel: 'Yoel', Amos: 'Amos', Obadiah: 'Obaja', Jonah: 'Yunus', Micah: 'Mikha',
  Nahum: 'Nahum', Habakkuk: 'Habakuk', Zephaniah: 'Zefanya', Haggai: 'Hagai', Zechariah: 'Zakharia',
  Malachi: 'Maleakhi', Matthew: 'Matius', Mark: 'Markus', Luke: 'Lukas', John: 'Yohanes',
  Acts: 'Kisah Para Rasul', Romans: 'Roma', '1 Corinthians': '1 Korintus', '2 Corinthians': '2 Korintus',
  Galatians: 'Galatia', Ephesians: 'Efesus', Philippians: 'Filipi', Colossians: 'Kolose',
  '1 Thessalonians': '1 Tesalonika', '2 Thessalonians': '2 Tesalonika', '1 Timothy': '1 Timotius',
  '2 Timothy': '2 Timotius', Titus: 'Titus', Philemon: 'Filemon', Hebrews: 'Ibrani', James: 'Yakobus',
  '1 Peter': '1 Petrus', '2 Peter': '2 Petrus', '1 John': '1 Yohanes', '2 John': '2 Yohanes', '3 John': '3 Yohanes',
  Jude: 'Yudas', Revelation: 'Wahyu', 'The Revelation': 'Wahyu', Rev: 'Wahyu', Wahyu: 'Wahyu'
};

const currentState = {
  type: 'IDLE',
  content: 'FLOW App Ready',
  meta: '',
  book: '',
  chapter: '',
  verse: '',
  song_title: '',
  active_line_index: 0, // Track which line is currently active (for accurate line sync)
  timestamp: Date.now(),
  bg_type: 'SOLID',
  bg_url: '',
  overlay: false,
  blackout: false,
  hide_text: false,
  obs_style: 0,
  style_anim: 'normal',
  style_font_idx: '0',
  style_size: '5.0',
  style_align: 'center',
  style_caps: 'false',
  style_text_bg: 'false',
  style_lh: '1.3',
  style_margin: '50',
  style_meta_size: '2.0',
  style_meta_font: '1',
  style_text_color: '#ffffff',
  style_highlight_color: '#ffd700'
};

// Camera/Stream Storage
let latestCameraFrame = null; // Store latest camera frame as base64
let activeCameraDevice = null; // Track which camera is active

// WebSocket clients tracking
let connectedClients = new Set();

// Broadcast state changes to all connected WebSocket clients
function broadcastStateChange() {
  const message = JSON.stringify({
    type: 'STATE_UPDATE',
    data: currentState
  });
  
  let sentCount = 0;
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });
  
  console.log(`[Broadcast] Sent to ${sentCount}/${connectedClients.size} clients, state type: ${currentState.type}`);
}

let bibleStructure = [];
let bibleByBook = new Map();

function ensureFile(filepath, fallback) {
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function moveFileIfNeeded(fromPath, toPath) {
  if (!fs.existsSync(fromPath)) return;
  if (fs.existsSync(toPath)) return;
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  fs.renameSync(fromPath, toPath);
}

function moveDirIfNeeded(fromPath, toPath) {
  if (!fs.existsSync(fromPath)) return;
  if (!fs.statSync(fromPath).isDirectory()) return;
  if (fs.existsSync(toPath)) return;
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  fs.renameSync(fromPath, toPath);
}

function migrateLegacyDataLayout() {
  // songs.json lama TIDAK dipindah/dipakai lagi (sumber lagu sekarang file per lagu di DATA/songs/).
  // Kalau songs.json masih ada, di-ignore — tidak dihapus otomatis (biar aman, user hapus manual).
  moveFileIfNeeded(path.join(ROOT_DIR, 'schedule.json'), SCHEDULE_FILE);
  moveFileIfNeeded(path.join(ROOT_DIR, 'saved_schedules.json'), SAVED_SCHED_FILE);
  moveFileIfNeeded(path.join(ROOT_DIR, 'slides.json'), path.join(DATA_DIR, 'slides.json'));

  moveFileIfNeeded(path.join(ROOT_DIR, 'favorites_songs.json'), path.join(DATA_DIR, 'favorites_songs.json'));

  moveDirIfNeeded(path.join(ROOT_DIR, 'backgrounds'), BG_DIR);
  moveDirIfNeeded(path.join(ROOT_DIR, 'biblelist.netlify.zefania'), DATA_BIBLE_DIR);
}

function loadJsonFile(filepath, fallback) {
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function saveJsonFile(filepath, data) {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    log(`[ERROR][JSON] Gagal simpan ke ${filepath}: ${e.message}`);
  }
}

// ---- Lagu: file per lagu (DATA/songs/<judul>.json) ----
// Asumsi (default David): folder DATA/songs/ DI-TRACK git agar bisa sync antar PC.
// Kalau lagu mau dianggap data lokal saja, tambahkan DATA/songs/ ke .gitignore.

function sanitizeFilename(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '').trim() || 'untitled';
}

function getSongFile(title) {
  return path.join(SONGS_DIR, sanitizeFilename(title) + '.json');
}

function loadSongFile(file) {
  try {
    const s = loadJsonFile(file, null);
    if (s && s.title) return s;
  } catch (e) {}
  return null;
}

// listSongs(): baca semua file .json di DATA/songs/ -> array [{title, lyrics}], sort by title.
function listSongs() {
  if (!fs.existsSync(SONGS_DIR)) return [];
  const songs = [];
  for (const f of fs.readdirSync(SONGS_DIR)) {
    if (path.extname(f).toLowerCase() !== '.json') continue;
    const s = loadSongFile(path.join(SONGS_DIR, f));
    if (s) songs.push({ title: s.title, lyrics: Array.isArray(s.lyrics) ? s.lyrics : [] });
  }
  songs.sort((a, b) => a.title.localeCompare(b.title, 'id'));
  return songs;
}

// findSongFile(title): cari file lagu sesuai judul. Coba path default (sanitize(title).json),
// lalu fallback scan folder yang cocok dengan field `title` di dalam file (antisipasi nama file lama).
function findSongFile(title) {
  const direct = getSongFile(title);
  if (fs.existsSync(direct)) return direct;
  if (fs.existsSync(SONGS_DIR)) {
    for (const f of fs.readdirSync(SONGS_DIR)) {
      if (path.extname(f).toLowerCase() !== '.json') continue;
      const s = loadSongFile(path.join(SONGS_DIR, f));
      if (s && String(s.title) === String(title)) return path.join(SONGS_DIR, f);
    }
  }
  return direct;
}

const LAST_SETTINGS_KEYS = ['style_anim','style_font_idx','style_size','style_align','style_caps','style_text_bg','style_lh','style_margin','style_meta_size','style_meta_font','style_text_color','style_highlight_color','bg_type','bg_url'];
function saveLastSettings() {
  const snap = {};
  LAST_SETTINGS_KEYS.forEach(k => { snap[k] = currentState[k]; });
  try {
    fs.writeFileSync(LAST_SETTINGS_FILE, JSON.stringify(snap, null, 2), 'utf8');
  } catch(e) {
    log(`[Settings] ERROR: Gagal simpan last_settings.json: ${e.message}`);
    console.error('[Settings] FAILED to save last_settings.json:', e.message);
  }
}
function loadLastSettings() {
  const saved = loadJsonFile(LAST_SETTINGS_FILE, null);
  console.log('');
  console.log('='.repeat(40));
  console.log('[LAST SETTINGS] File:', LAST_SETTINGS_FILE);
  if (!saved || typeof saved !== 'object') {
    console.log('[LAST SETTINGS] File tidak ada / kosong — pakai default');
    console.log('[LAST SETTINGS] font_idx :', currentState.style_font_idx, '(Montserrat default)');
    console.log('[LAST SETTINGS] size     :', currentState.style_size);
    console.log('[LAST SETTINGS] anim     :', currentState.style_anim);
    console.log('[LAST SETTINGS] align    :', currentState.style_align);
    console.log('='.repeat(40));
    console.log('');
    return;
  }
  LAST_SETTINGS_KEYS.forEach(k => { if (saved[k] !== undefined) currentState[k] = saved[k]; });
  console.log('[LAST SETTINGS] Berhasil dimuat:');
  console.log('[LAST SETTINGS] font_idx :', currentState.style_font_idx);
  console.log('[LAST SETTINGS] meta_font:', currentState.style_meta_font);
  console.log('[LAST SETTINGS] size     :', currentState.style_size);
  console.log('[LAST SETTINGS] anim     :', currentState.style_anim);
  console.log('[LAST SETTINGS] align    :', currentState.style_align);
  console.log('[LAST SETTINGS] caps     :', currentState.style_caps);
  console.log('[LAST SETTINGS] lh       :', currentState.style_lh);
  console.log('[LAST SETTINGS] margin   :', currentState.style_margin);
  console.log('[LAST SETTINGS] meta_size:', currentState.style_meta_size);
  console.log('[LAST SETTINGS] bg_type  :', currentState.bg_type);
  console.log('[LAST SETTINGS] bg_url   :', currentState.bg_url || '(kosong)');
  console.log('='.repeat(40));
  console.log('');
}

function listify(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function loadBibleData(bibleFile) {
  bibleStructure = [];
  bibleByBook = new Map();

  if (!fs.existsSync(bibleFile)) return;

  const xml = fs.readFileSync(bibleFile, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
    parseAttributeValue: false,
    parseTagValue: false
  });
  const parsed = parser.parse(xml);
  const bibleRoot = parsed?.XMLBIBLE || parsed;
  const books = listify(bibleRoot?.BIBLEBOOK);

  for (const book of books) {
    const xmlName = book?.bname || '';
    const indoName = BOOK_MAP[xmlName] || xmlName;
    const chapters = listify(book?.CHAPTER);
    bibleStructure.push({ id: xmlName, name: indoName, chapters: chapters.length });

    const chapterMap = new Map();
    for (const chapter of chapters) {
      const chapterNum = String(chapter?.cnumber || '');
      const verses = listify(chapter?.VERS).map((v) => ({
        verse: String(v?.vnumber || ''),
        text: typeof v === 'string' ? v : (v?.['#text'] || v?.text || '')
      }));
      chapterMap.set(chapterNum, verses);
    }
    bibleByBook.set(xmlName, chapterMap);
  }
}

function getIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function getWifiSsid() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('netsh wlan show interfaces', { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).toString('utf8');
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes('SSID') && !line.includes('BSSID')) {
          const parts = line.split(':');
          if (parts.length > 1) return parts.slice(1).join(':').trim();
        }
      }
    }
    return 'LAN / Tidak Terdeteksi';
  } catch {
    return 'Tidak Terdeteksi';
  }
}

function initData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('[Startup] Gagal buat DATA_DIR:', e.message);
  }
  migrateLegacyDataLayout();

  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });
  if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
  if (!fs.existsSync(DATA_BIBLE_DIR)) fs.mkdirSync(DATA_BIBLE_DIR, { recursive: true });
  if (!fs.existsSync(SONGS_DIR)) fs.mkdirSync(SONGS_DIR, { recursive: true });
  ensureFile(SCHEDULE_FILE, []);
  ensureFile(SAVED_SCHED_FILE, {});
  // Slide feature disabled: remove any persisted SLIDE items from schedule.
  const schedule = loadJsonFile(SCHEDULE_FILE, []);
  const cleaned = Array.isArray(schedule)
    ? schedule.filter((item) => String(item?.type || '').toUpperCase() !== 'SLIDE')
    : [];
  if (!Array.isArray(schedule) || cleaned.length !== schedule.length) {
    saveJsonFile(SCHEDULE_FILE, cleaned);
  }
  loadBibleData(currentBibleFile);
  loadLastSettings();
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get(['/','/index.html','/home'], (req, res) => {
  res.sendFile(path.join(TEMPLATE_DIR, 'home.html'));
});
app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.get('/operator', (req, res) => res.sendFile(path.join(TEMPLATE_DIR, 'operator.html')));
app.get('/projector', (req, res) => res.sendFile(path.join(TEMPLATE_DIR, 'projector.html')));
app.get('/overlay', (req, res) => res.sendFile(path.join(TEMPLATE_DIR, 'overlay.html')));
app.get('/obs', (req, res) => res.sendFile(path.join(TEMPLATE_DIR, 'obs.html')));
app.get('/monitor', (req, res) => res.sendFile(path.join(TEMPLATE_DIR, 'monitor.html')));

app.use('/templates', express.static(TEMPLATE_DIR));
app.use(express.static(SYSTEM_DIR));
app.use(express.static(ROOT_DIR));

app.get('/backgrounds/:name', (req, res) => {
  const filename = decodeURIComponent(req.params.name);
  const filePath = path.join(BG_DIR, filename);
  if (!fs.existsSync(filePath)) return res.sendStatus(404);
  return res.sendFile(filePath);
});

app.get('/api/backgrounds', (req, res) => {
  const files = [];
  if (fs.existsSync(BG_DIR)) {
    const validExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm']);
    for (const f of fs.readdirSync(BG_DIR)) {
      const ext = path.extname(f).toLowerCase();
      if (!validExts.has(ext)) continue;
      const type = ext === '.mp4' || ext === '.webm' ? 'VIDEO' : 'IMAGE';
      files.push({ name: f, type, url: `/backgrounds/${encodeURIComponent(f)}` });
    }
  }
  res.json(files);
});

app.get('/api/fonts', (req, res) => {
  const files = [];
  if (fs.existsSync(FONT_DIR)) {
    const validExts = new Set(['.otf', '.ttf', '.woff', '.woff2']);
    for (const f of fs.readdirSync(FONT_DIR)) {
      const ext = path.extname(f).toLowerCase();
      if (!validExts.has(ext)) continue;
      const base = path.basename(f, ext);
      const family = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
      files.push({
        id: `custom:${f}`,
        file: f,
        family,
        url: `/fonts/${encodeURIComponent(f)}`
      });
    }
  }
  files.sort((a, b) => a.family.localeCompare(b.family, 'id'));
  res.json(files);
});

// Camera Frame Endpoints

app.post('/api/camera/frame', express.raw({ type: 'application/octet-stream', limit: '5mb' }), (req, res) => {
  try {
    latestCameraFrame = req.body;
    activeCameraDevice = req.query.device || 'default';
    const now = new Date().toLocaleTimeString();
    let bodyLen = req.body && req.body.length !== undefined ? req.body.length : 'undefined';
    console.log(`[Camera][${now}] Frame received: ${bodyLen} bytes from device: ${activeCameraDevice}`);
    if (!req.body || req.body.length === undefined) {
      console.error(`[Camera][${now}] ERROR: req.body is`, typeof req.body, req.body);
      if (req.body && req.body instanceof Object) {
        try { console.error('req.body (JSON):', JSON.stringify(req.body)); } catch(e) {}
      }
    }
    if (!req.body || req.body.length < 1000) {
      console.warn(`[Camera][${now}] Warning: Frame too small or empty!`);
    }
    res.json({ status: 'ok', size: bodyLen });
  } catch (e) {
    console.error('[Camera] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/camera/frame', (req, res) => {
  const now = new Date().toLocaleTimeString();
  if (!latestCameraFrame) {
    console.warn(`[Camera][${now}] GET: No frame available`);
    return res.status(404).json({ error: 'No camera frame available' });
  }
  if (latestCameraFrame.length < 1000) {
    console.warn(`[Camera][${now}] GET: Frame too small (${latestCameraFrame.length} bytes)`);
  }
  console.log(`[Camera][${now}] GET: Serving frame (${latestCameraFrame.length} bytes)`);
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(latestCameraFrame);
});

app.get('/api/status', (req, res) => {
  const activePort = app?.locals?.activePort || PORT;
  res.json({ ip: getIpAddress(), ssid: getWifiSsid(), port: activePort });
});

app.get('/api/qr', async (req, res) => {
  const url = req.query.url || '';
  try {
    const matrix = await QRCode.create(url, { errorCorrectionLevel: 'M' });
    const data = matrix.modules.data;
    const size = matrix.modules.size;
    const rows = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) row.push(data[r * size + c] ? 1 : 0);
      rows.push(row);
    }
    res.json({ matrix: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/shutdown', (req, res) => {
  res.json({ ok: true });
  log('[API] Shutdown requested.');
  setTimeout(() => process.exit(0), 300);
});

app.get('/api/current', (req, res) => {
  res.json(currentState);
});

app.get('/api/set', (req, res) => {
  const mode = req.query.type || 'IDLE';
  console.log(`[API] /api/set called with type=${mode}`);
  console.log(`[API] Connected clients: ${connectedClients.size}`);

  if (mode === 'UPDATE_BG_ONLY') {
    const bgCmd = req.query.bg_cmd;
    if (bgCmd === 'CHANGE') {
      currentState.bg_type = req.query.bg_type || 'SOLID';
      currentState.bg_url = req.query.bg_url || '';
    } else if (bgCmd === 'OVERLAY') {
      currentState.overlay = String(req.query.val || 'false') === 'true';
    }
  } else if (mode === 'STYLE') {
    const fields = ['size','font','align','caps','text_bg','lh','margin','meta_size','meta_font','anim','text_color','highlight_color'];
    for (const field of fields) {
      if (req.query[field] === undefined) continue;
      if (field === 'size') currentState.style_size = String(req.query[field]);
      else if (field === 'font') currentState.style_font_idx = String(req.query[field]);
      else if (field === 'align') currentState.style_align = String(req.query[field]);
      else if (field === 'caps') currentState.style_caps = String(req.query[field]);
      else if (field === 'text_bg') currentState.style_text_bg = String(req.query[field]);
      else if (field === 'lh') currentState.style_lh = String(req.query[field]);
      else if (field === 'margin') currentState.style_margin = String(req.query[field]);
      else if (field === 'meta_size') currentState.style_meta_size = String(req.query[field]);
      else if (field === 'meta_font') currentState.style_meta_font = String(req.query[field]);
      else if (field === 'anim') currentState.style_anim = String(req.query[field]);
      else if (field === 'text_color') currentState.style_text_color = String(req.query[field]);
      else if (field === 'highlight_color') currentState.style_highlight_color = String(req.query[field]);
    }
  } else if (mode === 'OBS_STYLE') {
    const dir = parseInt(req.query.dir || '1', 10);
    currentState.obs_style = (currentState.obs_style + dir + 3) % 3;
  } else if (mode === 'HIDE_TEXT') {
    currentState.hide_text = String(req.query.val || 'false') === 'true';
  } else if (mode === 'BLACKOUT') {
    currentState.type = 'BLACKOUT';
    currentState.blackout = true;
  } else if (mode === 'IDLE') {
    currentState.type = 'IDLE';
    currentState.content = '';
    currentState.blackout = false;
    currentState.hide_text = false;
  } else {
    currentState.blackout = false;
    const contentVal = String(req.query.content || '');
    let metaVal = String(req.query.title || '');
    let bibleVer = '';
    if (mode === 'BIBLE') {
      bibleVer = (req.query.ver || '').toUpperCase();
      if (!metaVal) {
        let bk = String(req.query.book || '');
        const ch = String(req.query.chapter || '');
        const vs = String(req.query.verse || '');
        // For NKJV, use English book name
        if (bibleVer === 'NKJV') {
          // Try to find the English name from BOOK_MAP (reverse lookup)
          const indoToEng = Object.entries(BOOK_MAP).reduce((acc, [eng, indo]) => { acc[indo.toLowerCase()] = eng; return acc; }, {});
          const lowerBk = bk.toLowerCase();
          if (indoToEng[lowerBk]) bk = indoToEng[lowerBk];
        }
        if (bk && ch && vs) metaVal = `${bk} ${ch}:${vs}`;
      }
      if (metaVal && bibleVer && ['TB','BIS','NKJV'].includes(bibleVer)) {
        metaVal = `${metaVal} (${bibleVer})`;
      }
    }
    if (!metaVal && currentState.type === mode) metaVal = currentState.meta;
    currentState.type = mode;
    currentState.content = contentVal;
    currentState.meta = metaVal;
    
    // Store specific metadata for fallback sync
    currentState.book = req.query.book || '';
    currentState.chapter = req.query.chapter || '';
    currentState.verse = req.query.verse || '';
    currentState.song_title = req.query.title || '';

    // Save line index for accurate line sync across devices
    if (req.query.line_index !== undefined) {
      currentState.active_line_index = parseInt(req.query.line_index, 10) || 0;
    }
  }

  if (mode === 'STYLE' || (mode === 'UPDATE_BG_ONLY' && req.query.bg_cmd === 'CHANGE')) saveLastSettings();
  currentState.timestamp = Date.now();
  broadcastStateChange(); // Broadcast state change to all connected clients
  res.json({ status: 'ok' });
});

app.get('/api/songs', (req, res) => res.json(listSongs()));
app.get('/api/schedule', (req, res) => res.json(loadJsonFile(SCHEDULE_FILE, [])));
app.get('/api/saved_schedules', (req, res) => res.json(loadJsonFile(SAVED_SCHED_FILE, {})));
app.get('/api/bible/books', (req, res) => {
  const ver = (req.query.ver || 'TB').toUpperCase();
  const file = BIBLE_FILES[ver] || BIBLE_FILES.TB;
  loadBibleData(file);
  res.json(bibleStructure);
});

app.get('/api/bible/chapter', (req, res) => {
  const ver = (req.query.ver || 'TB').toUpperCase();
  const file = BIBLE_FILES[ver] || BIBLE_FILES.TB;
  loadBibleData(file);
  const bookId = String(req.query.book || '');
  const chapterNum = String(req.query.chapter || '');
  const chapterMap = bibleByBook.get(bookId);
  if (!chapterMap) return res.json([]);
  res.json(chapterMap.get(chapterNum) || []);
});

// --- Fuzzy song search: toleransi 1 huruf (mis: anugrahmu vs anugerahmu) ---
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// SEMUA kata query harus muncul di text target, toleran 1 huruf utk kata panjang (>=4)
function fuzzyWordsAppear(qLower, text) {
  const qWords = qLower.split(/\s+/).filter(Boolean);
  const tWords = text.split(/\s+/).filter(Boolean);
  if (!qWords.length || !tWords.length) return false;
  return qWords.every((qw) =>
    tWords.some((tw) =>
      tw === qw ||
      (qw.length >= 4 && Math.abs(tw.length - qw.length) <= 1 && levenshtein(tw, qw) <= 1)
    )
  );
}

app.get('/api/search', (req, res) => {
  const qRaw = String(req.query.q || '');
  // Abaikan karakter khusus ' " - saat pencarian (mis: sperti cocok dengan s'perti)
  const normalize = (s) => String(s).toLowerCase().replace(/['"\-]/g, '');
  const qLower = normalize(qRaw);
  const results = [];

  if (normalize(qRaw).length >= 3) {
    const songs = listSongs();
    for (const s of songs) {
      const title = String(s?.title || '');
      const normTitle = normalize(title);
      const lyrics = Array.isArray(s?.lyrics) ? s.lyrics : [];
      const lineTexts = lyrics.map((l) => String(l?.text || '')).filter(Boolean);
      // 1) exact dulu
      if (normTitle.includes(qLower)) {
        results.push({ type: 'SONG', title, match_text: 'Judul cocok', full_data: s });
        continue;
      }
      let exactLine = null;
      for (const text of lineTexts) {
        if (normalize(text).includes(qLower)) { exactLine = text; break; }
      }
      if (exactLine !== null) {
        results.push({ type: 'SONG', title, match_text: exactLine, full_data: s });
        continue;
      }
      // 2) fuzzy fallback (toleran 1 huruf: anugrahmu ~ anugerahmu)
      if (fuzzyWordsAppear(qLower, normTitle) || lineTexts.some((t) => fuzzyWordsAppear(qLower, normalize(t)))) {
        results.push({ type: 'SONG', title, match_text: title + ' (fuzzy)', full_data: s });
      }
    }

    const keywords = normalize(qRaw).split(/\s+/).filter(Boolean);
    const limit = 20;
    let count = 0;
    for (const b of bibleStructure) {
      if (count >= limit) break;
      const chapterMap = bibleByBook.get(b.id);
      if (!chapterMap) continue;
      for (const [chapter, verses] of chapterMap) {
        for (const v of verses) {
          const txt = String(v.text || '');
          const txtLower = txt.toLowerCase();
          if (keywords.every((k) => txtLower.includes(k))) {
            results.push({
              type: 'BIBLE',
              book: b.name,
              id: b.id,
              chapter,
              verse: v.verse,
              text: txt
            });
            count += 1;
            if (count >= limit) break;
          }
        }
        if (count >= limit) break;
      }
    }
  }

  res.json(results);
});

app.post('/api/songs', (req, res) => {
  const data = req.body || {};
  const title = String(data.title || '').trim();
  if (!title) return res.status(400).json({ status: 'error', error: 'title tidak boleh kosong' });
  const song = { title, lyrics: Array.isArray(data.lyrics) ? data.lyrics : [] };
  try {
    fs.writeFileSync(getSongFile(title), JSON.stringify(song, null, 2), 'utf8');
    res.json({ status: 'saved' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.post('/api/schedule', (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : [];
  const withoutSlides = incoming.filter((item) => String(item?.type || '').toUpperCase() !== 'SLIDE');
  saveJsonFile(SCHEDULE_FILE, withoutSlides);
  res.json({ status: 'saved' });
});

app.post('/api/saved_schedules', (req, res) => {
  const data = req.body || {};
  const saved = loadJsonFile(SAVED_SCHED_FILE, {});
  const stripSlides = (items) => (Array.isArray(items)
    ? items.filter((item) => String(item?.type || '').toUpperCase() !== 'SLIDE')
    : []);

  if (data.action === 'save') {
    saved[data.name] = stripSlides(data.content);
    saveJsonFile(SAVED_SCHED_FILE, saved);
    return res.json({ status: 'ok' });
  }

  if (data.action === 'load' && data.name in saved) {
    const cleaned = stripSlides(saved[data.name]);
    saveJsonFile(SCHEDULE_FILE, cleaned);
    return res.json({ status: 'loaded', data: cleaned });
  }

  if (data.action === 'delete' && data.name in saved) {
    delete saved[data.name];
    saveJsonFile(SAVED_SCHED_FILE, saved);
    return res.json({ status: 'ok' });
  }

  res.json({ status: 'ok' });
});

app.put('/api/songs', (req, res) => {
  const data = req.body || {};
  const originalTitle = String(data.original_title || '').trim();
  const song = data.song || {};
  const newTitle = String(song.title || '').trim();
  if (!newTitle) return res.status(400).json({ status: 'error', error: 'title tidak boleh kosong' });
  try {
    if (originalTitle && newTitle && originalTitle !== newTitle) {
      // Rename: hapus file lama + tulis baru
      const oldFile = findSongFile(originalTitle);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    } else {
      // Update judul sama -> timpa file (cari berdasarkan judul lama kalau ada)
      if (originalTitle && fs.existsSync(getSongFile(originalTitle)) === false) {
        const matched = findSongFile(originalTitle);
        if (fs.existsSync(matched)) fs.unlinkSync(matched);
      }
    }
    fs.writeFileSync(getSongFile(newTitle), JSON.stringify(song, null, 2), 'utf8');
    res.json({ status: 'updated' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.delete('/api/songs', (req, res) => {
  const title = String(req.query.title || '').trim();
  if (!title) return res.status(400).json({ status: 'error', error: 'title tidak boleh kosong' });
  try {
    const file = findSongFile(title);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ status: 'deleted' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// TEMPLATE SETTINGS API
app.get('/api/template', (req, res) => {
  const name = req.query.name;
  if (!name) {
    // Get all templates
    try {
      if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, {recursive: true});
      const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.json'));
      const templates = {};
      files.forEach(f => {
        const content = loadJsonFile(path.join(TEMPLATE_DIR, f), {});
        templates[f.replace('.json', '')] = content;
      });
      return res.json(templates);
    } catch (e) {
      return res.json({});
    }
  } else {
    // Get specific template
    try {
      const file = path.join(TEMPLATE_DIR, `${name}.json`);
      if (fs.existsSync(file)) {
        const content = loadJsonFile(file, {});
        return res.json(content);
      }
      return res.status(404).json({});
    } catch (e) {
      return res.status(404).json({});
    }
  }
});

app.post('/api/template', (req, res) => {
  try {
    const {name, settings} = req.body || {};
    if (!name || !settings) return res.status(400).json({status: 'error'});
    if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, {recursive: true});
    saveJsonFile(path.join(TEMPLATE_DIR, `${name}.json`), {settings});
    res.json({status: 'ok'});
  } catch (e) {
    res.status(500).json({status: 'error', error: e.message});
  }
});

app.delete('/api/template', (req, res) => {
  try {
    const name = req.query.name;
    if (!name) return res.status(400).json({status: 'error'});
    const file = path.join(TEMPLATE_DIR, `${name}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return res.json({status: 'ok'});
    }
    return res.status(404).json({status: 'error'});
  } catch (e) {
    res.status(500).json({status: 'error', error: e.message});
  }
});

function tryListen(port, allowFallback, resolve, reject) {
  const fallbackPort = 8089;
  const server = app.listen(port, '0.0.0.0');

  // Initialize WebSocket server on the same HTTP server
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    connectedClients.add(ws);
    console.log(`[WebSocket] Client connected. Total: ${connectedClients.size}`);
    
    // Send current state to newly connected client
    ws.send(JSON.stringify({
      type: 'STATE_UPDATE',
      data: currentState
    }));

    // Handle WebSocket close
    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log(`[WebSocket] Client disconnected. Total: ${connectedClients.size}`);
    });

    // Handle errors
    ws.on('error', (err) => {
      console.error(`[WebSocket] Error:`, err.message);
    });
  });

  server.once('listening', () => {
    app.locals.activePort = port;
    console.log('-'.repeat(40));
    console.log(`DS Worship Lite (Node) berjalan di port ${port}`);
    console.log(`Operator: http://localhost:${port}/operator`);
    console.log(`Projector: http://localhost:${port}/projector`);
    console.log(`WebSocket: ws://localhost:${port}`);
    resolve({ app, server, port, wss });
  });

  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && allowFallback && port === 80) {
      console.log('Port 80 sedang dipakai. Mencoba fallback ke port 8089...');
      tryListen(fallbackPort, false, resolve, reject);
      return;
    }
    reject(err);
  });
}

function startServer(preferredPort = PORT) {
  initData();
  return new Promise((resolve, reject) => {
    tryListen(preferredPort, true, resolve, reject);
  });
}

module.exports = {
  app,
  startServer,
  currentState
};

process.on('SIGINT', () => { saveLastSettings(); process.exit(0); });
process.on('SIGTERM', () => { saveLastSettings(); process.exit(0); });

// ============================================================
// Windows: Auto-setup firewall + network profile (elevated, one-time)
// ============================================================

function needsNetworkSetup() {
  try {
    // Cek apakah firewall rule sudah ada
    const ruleCheck = execSync('netsh advfirewall firewall show rule name="FLOW-Port-80"', { encoding: 'utf8', windowsHide: true });
    const hasRule = ruleCheck.includes('FLOW-Port-80');
    // Cek apakah network profile sudah Private
    const profileCheck = execSync('powershell -Command "Get-NetConnectionProfile | Where-Object {$_.IPv4Connectivity -eq \'Internet\' -or $_.IPv4Connectivity -eq \'LocalNetwork\'} | Select-Object -ExpandProperty NetworkCategory"', { encoding: 'utf8', shell: true, windowsHide: true });
    const isPublic = profileCheck.trim().includes('Public');
    return !hasRule || isPublic;
  } catch {
    return true;
  }
}

function runElevatedSetup() {
  const psScript = [
    'netsh advfirewall firewall delete rule name="FLOW-Port-80" | Out-Null',
    'netsh advfirewall firewall delete rule name="FLOW-Port-8089" | Out-Null',
    'netsh advfirewall firewall add rule name="FLOW-Port-80" dir=in action=allow protocol=TCP localport=80 | Out-Null',
    'netsh advfirewall firewall add rule name="FLOW-Port-8089" dir=in action=allow protocol=TCP localport=8089 | Out-Null',
    'Get-NetConnectionProfile | Where-Object {$_.IPv4Connectivity -eq "Internet" -or $_.IPv4Connectivity -eq "LocalNetwork"} | Set-NetConnectionProfile -NetworkCategory Private'
  ].join('; ');

  try {
    execSync(`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile -WindowStyle Hidden -Command ${psScript.replace(/"/g, '\\"')}' -Wait"`, { shell: true, stdio: 'ignore', windowsHide: true });
    log('[Setup] Firewall dan network profile berhasil dikonfigurasi.');
  } catch (e) {
    log('[Setup] Konfigurasi otomatis gagal (mungkin UAC ditolak): ' + e.message);
  }
}

function pauseAndExit(code) {
  if (process.stdin.isTTY) {
    console.log('\nTekan Enter untuk menutup...');
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(code));
  } else {
    setTimeout(() => process.exit(code), 5000);
  }
}


if (require.main === module || process.pkg) {
  log('FLOW starting...');
  log('ROOT_DIR = ' + ROOT_DIR);
  log('SYSTEM_DIR = ' + SYSTEM_DIR);
  log('DATA_DIR = ' + DATA_DIR);
  log('process.pkg = ' + !!process.pkg);
  log('process.execPath = ' + process.execPath);
  log('__dirname = ' + __dirname);
  if (process.platform === 'win32' && needsNetworkSetup()) {
    log('[Setup] Konfigurasi jaringan diperlukan, meminta izin admin...');
    runElevatedSetup();
  }
  let serverPromise;
  try {
    log('Calling startServer...');
    serverPromise = startServer(PORT);
  } catch (err) {
    console.error('\n[ERROR] Gagal inisialisasi server:', err.message || err);
    pauseAndExit(1);
    return;
  }
  serverPromise.then(({ port }) => {
    const { networkInterfaces } = require('os');
    let localIp = 'localhost';
    for (const ifaces of Object.values(networkInterfaces())) {
      for (const iface of ifaces) {
        if (iface.family === 'IPv4' && !iface.internal) { localIp = iface.address; break; }
      }
      if (localIp !== 'localhost') break;
    }
    const portStr = (port === 80 || port === 443) ? '' : `:${port}`;
    log(`Server berjalan di port ${port}`);
    log(`Operator  : http://${localIp}${portStr}/operator`);
    log(`Projector : http://${localIp}${portStr}/projector`);
    // Buka halaman home di browser root
    const homeUrl = `http://localhost${portStr}/`;
    log(`[FLOW] Membuka browser: ${homeUrl}`);
    try { execSync(`start "" "${homeUrl}"`, { shell: true, windowsHide: true }); } catch(e) { log('[UI] Gagal buka browser: ' + e.message); }
  }).catch((err) => {
    log('[ERROR] Server gagal start: ' + (err.message || err));
    pauseAndExit(1);
  });
}