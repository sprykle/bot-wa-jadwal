const XLSX = require('xlsx');

// Fungsi pembaca jadwal tanpa Python
function getJadwal() {
  try {
    const workbook = XLSX.readFile('23 Agustus -- Jadwal MatKul.xlsx');
    let allData = [];
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      allData = allData.concat(data);
    });

    // Sesuaikan waktu WIB (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60;
    const wibTime = new Date(now.getTime() + (wibOffset + now.getTimezoneOffset()) * 60000);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariTarget = days[wibTime.getDay()];

    const dfHari = allData.filter(row => row['Hari'] === hariTarget);
    if (dfHari.length === 0) return `Tidak ada jadwal kuliah untuk hari ${hariTarget}.`;

    let pesan = `=== JADWAL HARI INI (${hariTarget.toUpperCase()}) ===\n`;
    dfHari.forEach(row => {
      pesan += `\n[${row['Jam'] || '-'}] - [${row['Ruang'] || '-'}] ${row['Nama MK'] || '-'}\n`;
    });
    return pesan;
  } catch (err) {
    return '❌ Gagal membaca file jadwal.';
  }
}

// Di dalam client.on('message_create'):
else if (pesan === '!jadwal' || pesan === '!getjadwal') {
  const hasilJadwal = getJadwal();
  await msg.reply(hasilJadwal);
}
