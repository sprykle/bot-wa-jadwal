const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const WWEBJS_DATA_PATH = '/data/.wwebjs_auth';
let currentQr = '';
let isReady = false; // status koneksi WA yang SEBENARNYA — beda dari "belum ada QR"

// Safety net umum: kalau ada error tak terduga dari library manapun,
// jangan sampai menjatuhkan seluruh proses.
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught exception (bot tetap jalan, tidak restart):', err.message);
});

// Chromium bikin file SingletonLock/SingletonCookie/SingletonSocket di folder
// profil waktu jalan, dan menghapusnya sendiri kalau ditutup rapi. Karena
// container Railway kadang di-restart paksa (bukan dimatikan rapi), file2 ini
// bisa ketinggalan di dalam Volume yang persisten — lalu di startup berikutnya
// Chromium ngira profil masih dipakai proses lain & menolak jalan ("The
// profile appears to be in use by another Chromium process"). Karena cuma ada
// satu instance service ini yang jalan dalam satu waktu, file kunci yang
// ketemu di awal startup PASTI sisa lama, aman dihapus.
function bersihkanLockChromiumLama(rootDir) {
  const namaFileLock = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  if (!fs.existsSync(rootDir)) return;

  function jelajahi(dir) {
    let daftar;
    try {
      daftar = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entri of daftar) {
      const fullPath = path.join(dir, entri.name);
      if (namaFileLock.includes(entri.name)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`Menghapus lock Chromium lama: ${fullPath}`);
        } catch (e) {
          console.error(`Gagal menghapus ${fullPath}:`, e.message);
        }
      } else if (entri.isDirectory()) {
        jelajahi(fullPath);
      }
    }
  }
  jelajahi(rootDir);
}
bersihkanLockChromiumLama(WWEBJS_DATA_PATH);

// ================= 1. SERVER WEB SCAN QR =================
app.get('/', async (req, res) => {
  if (isReady) {
    return res.send(`
      <div style="text-align:center; padding-top: 50px; font-family:sans-serif;">
        <h2>Bot WhatsApp Berhasil Terhubung! ✅</h2>
        <p>Silakan tes kirim pesan <b>!jadwal</b> dari WhatsApp.</p>
      </div>
    `);
  }
  if (!currentQr) {
    return res.send(`
      <div style="text-align:center; padding-top: 50px; font-family:sans-serif;">
        <h2>⏳ Belum siap</h2>
        <p>Klien WhatsApp belum menghasilkan QR code (masih starting up). Cek log Deployments di Railway, lalu refresh halaman ini beberapa saat lagi.</p>
      </div>
    `);
  }
  try {
    const qrImage = await qrcode.toDataURL(currentQr);
    res.send(`
      <html>
        <head>
          <title>Scan WA Bot QR Code</title>
          <meta http-equiv="refresh" content="10">
        </head>
        <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background-color: #f0f2f5;">
          <h2 style="color: #075e54;">Scan QR Code WhatsApp Bot</h2>
          <img src="${qrImage}" style="width:300px; height:300px; border: 10px solid white; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
          <p style="color: #666; margin-top: 15px;">Halaman otomatis refresh setiap 10 detik</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Gagal membuat gambar QR Code');
  }
});

app.listen(PORT, () => {
  console.log(`Server web QR berjalan di port ${PORT}`);
});

// ================= 2. CLIENT WHATSAPP (RAM OPTIMIZED) =================
// Balik ke LocalAuth (bukan RemoteAuth+MongoDB) — RemoteAuth kena bug zip
// yang belum diperbaiki di library-nya (wwebjs-mongo sudah setahun lebih
// nggak di-update). LocalAuth nyimpen sesi langsung sebagai file biasa,
// tanpa proses kompres/zip, jadi bug itu nggak relevan lagi di sini.
//
// Supaya sesi tetap TIDAK hilang tiap Railway redeploy, dataPath di bawah
// harus menunjuk ke folder yang ada di dalam Railway VOLUME (bukan folder
// biasa di container, yang selalu direset tiap redeploy).
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: WWEBJS_DATA_PATH
  }),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      // --- flag tambahan biar Chromium hemat RAM ---
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-popup-blocking',
      '--disable-print-preview',
      '--disable-prompt-on-repost',
      '--disable-speech-api',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      '--use-mock-keychain',
      '--blink-settings=imagesEnabled=false', // matikan load foto profil/media WA Web — bot ini cuma butuh teks
      '--js-flags="--max-old-space-size=256"'
    ]
  }
});

client.on('qr', (qr) => {
  currentQr = qr;
  console.log('QR Code baru dihasilkan. Silakan scan via domain publik Railway!');
});

client.on('ready', () => {
  currentQr = '';
  isReady = true;
  console.log('Bot WhatsApp Berhasil Terhubung!');
});

client.on('disconnected', (reason) => {
  isReady = false;
  console.log('Client terputus:', reason);
});

// ================= 3. LISTEN PESAN WHATSAPP =================
client.on('message_create', async (msg) => {
  const pesan = msg.body.trim().toLowerCase();

  if (pesan === '!ping' || pesan === 'ping') {
    await msg.reply('pong! 🚀 Bot WhatsApp aktif.');
  } 
  else if (pesan === '!jadwal' || pesan === '!getjadwal') {
    await msg.reply('⏳ Sedang mengambil data jadwal, mohon tunggu...');

    exec('python3 get_jadwal.py', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing python: ${error}`);
        return msg.reply('❌ Gagal menjalankan skrip get_jadwal.py');
      }
      const output = stdout.trim() || '✅ Selesai memproses jadwal.';
      msg.reply(output);
    });
  }
});

client.initialize();
