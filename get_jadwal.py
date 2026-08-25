from datetime import datetime, timezone, timedelta
import pandas as pd

def get_jadwal():
    file_path = '23 Agustus -- Jadwal MatKul.xlsx'

    xls = pd.ExcelFile(file_path)
    list_df = [pd.read_excel(file_path, sheet_name=sheet) for sheet in xls.sheet_names]
    df_all = pd.concat(list_df, ignore_index=True)

    # Pakai WIB (UTC+7) secara eksplisit — server Railway biasanya jalan di UTC,
    # jadi kalau pakai datetime.now() polos, "hari ini" bisa salah pas dini hari WIB.
    wib = timezone(timedelta(hours=7))
    hari_ini_en = datetime.now(wib).strftime('%A')
    mapping_hari = {
        'Monday': 'Senin',
        'Tuesday': 'Selasa',
        'Wednesday': 'Rabu',
        'Thursday': 'Kamis',
        'Friday': 'Jumat',
        'Saturday': 'Sabtu',
        'Sunday': 'Minggu'
    }
    hari_target = mapping_hari.get(hari_ini_en, hari_ini_en)

    df_hari = df_all[df_all['Hari'] == hari_target]
    if df_hari.empty:
        return f'Tidak ada jadwal kuliah untuk hari {hari_target}.'

    kolom = ['Ruang', 'Nama MK', 'Hari', 'Jam']
    df_bersih = df_hari[kolom].copy()
    df_bersih['Ruang'] = df_bersih['Ruang'].astype(str).str.replace(r'\s+\d+$', '', regex=True)
    df_bersih = df_bersih.drop_duplicates().sort_values(by='Jam')

    pesan = f'=== JADWAL HARI INI ({hari_target.upper()}) ===\n'
    for jam, group in df_bersih.groupby('Jam'):
        pesan += f'\n{jam}\n'
        for _, row in group.iterrows():
            ruang = row['Ruang']
            nama_mk = row['Nama MK']
            pesan += f' - [{ruang}] {nama_mk}\n'
    return pesan

if __name__ == '__main__':
    print(get_jadwal())
