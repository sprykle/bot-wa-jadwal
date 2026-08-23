const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
let currentQr = '';

app.get('/', async (req, res) => {
  if (!currentQr) {
    return res.send('<div style="text-align:center; padding-top: 50px; font-family:sans-serif;"><h2>QR Code belum siap atau bot sudah terhubung!</h2><p>Cek log di Railway jika bot sudah login.</p></div>');
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

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(() => {
  console.log('Terhubung ke MongoDB Atlas!');

  const store = new MongoStore({ mongoose: mongoose });

  const client = new Client({
    authStrategy: new RemoteAuth({
      store: store,
      backupSyncIntervalMs: 300000
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
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    currentQr = qr;
    console.log('QR Code baru dihasilkan. Silakan buka domain publik Railway!');
  });

  client.on('ready', () => {
    currentQr = '';
    console.log('Bot WhatsApp Berhasil Terhubung!');
  });

  client.initialize();
}).catch((err) => {
  console.error('Gagal terhubung ke MongoDB:', err);
});