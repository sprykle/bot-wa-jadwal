const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

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

  // Tampilkan string QR mentah agar bisa di-generate sendiri jika perlu
  client.on('qr', (qr) => {
    console.log('==================================================');
    console.log('QR CODE DATA URL (Copy teks di bawah lalu buka di browser/QR generator):');
    console.log(qr);
    console.log('==================================================');
  });

  client.on('ready', () => {
    console.log('Client is ready! Bot WhatsApp Berhasil Konek!');
  });

  client.initialize();
}).catch((err) => {
  console.error('Gagal terhubung ke MongoDB:', err);
});