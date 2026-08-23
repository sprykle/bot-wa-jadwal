const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');

// URL MongoDB Atlas (Bisa dibaca dari environment variable atau string langsung)
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://hiuomponk2108_db_user:o4wDP4RjKO6Fx6ut@cluster0.rmciri1b.mongodb.net/wabotsession?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI).then(() => {
    console.log('Terhubung ke MongoDB Atlas!');
    
    const store = new MongoStore({ mongoose: mongoose });
    
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 // Backup session setiap 5 menit
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
        console.log('SCAN QR CODE DI BAWAH INI:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('Bot WA Online & Sesi tersimpan di MongoDB!');
    });

    client.on('message', async (msg) => {
        const pesan = msg.body.trim().toLowerCase();

        if (pesan === '!jadwal') {
            console.log(`Menerima perintah !jadwal dari ${msg.from}`);

            // Menjalankan script Python get_jadwal.py
            exec('python3 get_jadwal.py', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error Exec: ${error.message}`);
                    // Fallback jika di Windows memakai perintah 'python'
                    exec('python get_jadwal.py', (errWin, stdoutWin) => {
                        if (errWin) {
                            msg.reply('Gagal mengambil data jadwal.');
                            return;
                        }
                        msg.reply(stdoutWin);
                    });
                    return;
                }
                msg.reply(stdout);
            });
        }
    });

    client.initialize();
}).catch(err => {
    console.error('Gagal terhubung ke MongoDB:', err);
});