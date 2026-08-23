const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;
let currentQr = '';

// Route Web untuk Menampilkan Gambar QR Code
app.get('/', async (req, res) => {
  if (!currentQr) {
    return res.send('<h2>QR Code belum siap atau bot sudah berhasil login! Silakan cek log Railway.</h2>');
  }
  try {
    const qrImage = await qrcode.toDataURL(currentQr);
    res.send(`
      <html>
        <head>
          <title>Scan WA Bot QR Code</title>
          <meta http-equiv="refresh" content="15">
        </head>
        <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
          <h2>Scan QR Code Bot WhatsApp</h2>
          <img src="${qrImage}" style="width:300px; height:300px;" />
          <p>Halaman ini akan refresh otomatis setiap 15 detik.</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Error generating QR Code');
  }
});

app.listen(port, () => {
  console.log(`Server web QR Code berjalan di port ${port}`);
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
    console.log('QR Code baru berhasil di-generate! Silakan buka domain Railway kamu.');
  });

  client.on('ready', () => {
    currentQr = '';
    console.log('Client is ready! Bot WhatsApp Berhasil Konek!');
  });

  client.initialize();
}).catch((err) => {
  console.error('Gagal terhubung ke MongoDB:', err);
});