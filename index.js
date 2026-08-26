const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const express = require('express');
const qrcode = require('qrcode');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
let currentQr = '';
let isReady = false; // status koneksi WA yang SEBENARNYA — beda dari "belum ada QR"

// RemoteAuth (whatsapp-web.js) punya bug yang cukup dikenal: kadang gagal baca
// file .zip backup sesi yang baru saja ditulis (race condition di internal
// library-nya), lalu ini nge-throw 'error' event tanpa listener -> uncaught
// exception -> proses Node mati -> Railway auto-restart -> minta scan QR lagi.
// Ini bukan bug di kode kita, jadi kita tangkap di level process supaya bot
// nggak mati total gara-gara satu backup gagal.
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught exception (bot tetap jalan, tidak restart):', err.message);
});

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
        <p>Klien WhatsApp belum menghasilkan QR code (masih starting up, atau gagal konek ke MongoDB/Chromium). Cek log Deployments di Railway, lalu refresh halaman ini beberapa saat lagi.</p>
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

// ================= 2. KONEKSI MONGODB + CLIENT WHATSAPP (RAM OPTIMIZED) =================
// RemoteAuth + MongoStore dipakai (bukan LocalAuth) supaya sesi WA tidak hilang
// tiap kali Railway redeploy/restart container — filesystem container Railway
// tidak persisten, jadi LocalAuth akan selalu minta scan QR ulang di sana.
// Butuh env var MONGODB_URI di Railway (provision MongoDB, lalu isi connection string-nya).
mongoose.connect(process.env.MONGODB_URI).then(() => {
  const store = new MongoStore({ mongoose });

  const client = new Client({
    authStrategy: new RemoteAuth({
      store: store,
      backupSyncIntervalMs: 300000 // minimal 60000 (ms)
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
        '--js-flags="--max-old-space-size=512"'
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

  client.on('remote_session_saved', () => {
    console.log('Sesi WhatsApp berhasil disimpan ke MongoDB.');
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
}).catch((err) => {
  console.error('Gagal konek ke MongoDB:', err);
});
