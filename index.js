const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
let currentQr = '';

// ================= 1. SERVER WEB SCAN QR =================
app.get('/', async (req, res) => {
  if (!currentQr) {
    return res.send(`
      <div style="text-align:center; padding-top: 50px; font-family:sans-serif;">
        <h2>Bot WhatsApp Berhasil Terhubung! ✅</h2>
        <p>Silakan tes kirim pesan <b>!jadwal</b> dari WhatsApp.</p>
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

// ================= 2. CLIENT WHATSAPP (LOCAL AUTH) =================
const client = new Client({
  authStrategy: new LocalAuth(),
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
  console.log('QR Code baru dihasilkan. Silakan scan via domain publik Railway!');
});

client.on('ready', () => {
  currentQr = '';
  console.log('Bot WhatsApp Berhasil Terhubung!');
});

// ================= 3. LISTEN PESAN WHATSAPP =================
client.on('message', async (msg) => {
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