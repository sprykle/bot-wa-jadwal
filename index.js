const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI tidak ditemukan di Environment Variables Railway!');
  process.exit(1);
}

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
    console.log('\n=================== SCAN QR CODE ===================\n');
    qrcode.generate(qr, { small: true });
    console.log('\n====================================================\n');
  });

  client.on('ready', () => {
    console.log('Client is ready! Bot WhatsApp berhasil aktif.');
  });

  client.on('authenticated', () => {
    console.log('Autentikasi berhasil! Sesi tersimpan ke MongoDB.');
  });

  client.on('auth_failure', (msg) => {
    console.error('Gagal autentikasi:', msg);
  });

  client.on('message', async (msg) => {
    if (msg.body === '!ping') {
      msg.reply('pong');
    }
  });

  client.initialize();
}).catch((err) => {
  console.error('Gagal terhubung ke MongoDB:', err);
});