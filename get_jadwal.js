const XLSX = require('xlsx');

const FILE_PATH = '23 Agustus -- Jadwal MatKul.xlsx';

const MAPPING_HARI = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Minggu',
};
const NAMA_HARI_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hariIniWib() {
  // Trik hitung waktu WIB (UTC+7) tanpa library timezone: geser Date.now()
  // sebesar offset-nya, lalu baca komponen UTC dari hasilnya.
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const sekarangWib = new Date(Date.now() + wibOffsetMs);
  const hariEn = NAMA_HARI_EN[sekarangWib.getUTCDay()];
  return MAPPING_HARI[hariEn] || hariEn;
}

function getJadwal() {
  const workbook = XLSX.readFile(FILE_PATH);

  let semuaBaris = [];
  for (const namaSheet of workbook.SheetNames) {
    const baris = XLSX.utils.sheet_to_json(workbook.Sheets[namaSheet], { defval: '' });
    semuaBaris = semuaBaris.concat(baris);
  }

  const hariTarget = hariIniWib();
  const jadwalHariIni = semuaBaris.filter((row) => row['Hari'] === hariTarget);

  if (jadwalHariIni.length === 0) {
    return `Tidak ada jadwal kuliah untuk hari ${hariTarget}.`;
  }

  // Bersihkan kolom Ruang (buang angka nyasar di akhir) + dedupe
  const sudahDilihat = new Set();
  const bersih = [];
  for (const row of jadwalHariIni) {
    const ruang = String(row['Ruang'] || '').replace(/\s+\d+$/, '');
    const namaMK = row['Nama MK'];
    const jam = row['Jam'];
    const kunci = `${ruang}|${namaMK}|${jam}`;
    if (!sudahDilihat.has(kunci)) {
      sudahDilihat.add(kunci);
      bersih.push({ ruang, namaMK, jam });
    }
  }
  bersih.sort((a, b) => String(a.jam).localeCompare(String(b.jam)));

  let pesan = `=== JADWAL HARI INI (${hariTarget.toUpperCase()}) ===\n`;
  let jamSebelumnya = null;
  for (const row of bersih) {
    if (row.jam !== jamSebelumnya) {
      pesan += `\n${row.jam}\n`;
      jamSebelumnya = row.jam;
    }
    pesan += ` - [${row.ruang}] ${row.namaMK}\n`;
  }
  return pesan;
}

module.exports = { getJadwal };

if (require.main === module) {
  console.log(getJadwal());
}
