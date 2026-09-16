# Rencana: Amalan Yaumi Extension + Fitur Penilaian ASA

> **Status:** Draft — Menunggu persetujuan sebelum eksekusi
> **Tanggal:** 2026-09-16

---

## Temuan Kodebase

| Aspek | Status |
|-------|--------|
| `daily_worship_logs` | 12 kolom (5 shalat wajib, dhuha, rawatib qobliyah/badiyah, catatan) — **belum ada tahajjud & Al-Qur'an** |
| Skor | `amalanScore.js` — max 25 poin, **belum ada poin untuk tahajjud & Al-Qur'an** |
| Berhalangan | **Tidak ada** fitur untuk menandai hari berhalangan (haid, sakit, dll) |
| Penilaian | **Tidak ada** tabel penilaian/assessment sama sekali |
| Admin monitoring | Query langsung ke Supabase (bypass composable), realtime aktif |
| RLS | Admin hanya bisa `SELECT` pada `daily_worship_logs` |

---

## BAGIAN 1: Amalan Yaumi Extension

### 1A. Database — tambah kolom ke `daily_worship_logs`

```
Migration 00012_amalan_extension.sql

Tambah kolom:
- tahajjud           shalat_status    DEFAULT 'belum'
- bacaan_quran       jsonb            DEFAULT '{}'
    -- { surah: int, ayat_awal: int, ayat_akhir: int }
    -- atau { halaman: int } untuk mode halaman
- berhalangan        boolean          DEFAULT false
- alasan_berhalangan text             DEFAULT ''
```

**`bacaan_quran`** — jsonb fleksibel:
- `surah`: nomor surah (1-114)
- `ayat_awal`: ayat awal bacaan
- `ayat_akhir`: ayat akhir bacaan
- Atau `halaman` untuk mode halaman (Al-Qur'an 30 juz)

**`berhalangan`** — menandai hari tidak bisa beramalan:
- `true` + `alasan_berhalangan`: "Haid", "Sakit", "Bepergian", dll
- Hari berhalangan → **tidak dihitung** dalam konsistensi & skor

### 1B. Skor — update `amalanScore.js`

```
Skor baru (max 35):
- Shalat Wajib x5    : 4 x 5 = 20  (tetap)
- Dhuha              : 3           (tetap)
- Jumlah rakaat      : 2           (tetap)
- Tahajjud           : 5  (BARU)   -- tepat_waktu=5, terlambat=3, qadha=1, belum=0
- Bacaan Al-Qur'an   : 5  (BARU)   -- ada data=5, null=0

AMALAN_SKOR_MAX = 35
```

### 1C. Composable — update `useAmalan.js`

- `upsertLog()` → handle kolom baru (`tahajjud`, `bacaan_quran`, `berhalangan`, `alasan_berhalangan`)
- `hitungKonsistensi()` → skip hari `berhalangan = true`
- `getLog()` return include kolom baru

### 1D. User View — update `AmalanHarianView.vue`

- Tambah section **Tahajjud** (radio: tepat_waktu/terlambat/qadha/belum)
- Tambah section **Bacaan Al-Qur'an** (input: surah + ayat_awal + ayat_akhir, atau halaman)
- Tambah toggle **Berhalangan** + input alasan (text/dropdown)
- Jika `berhalangan = true` → sembunyikan form shalat, tampilkan badge "Berhalangan: {alasan}"
- Update score card → max 35

### 1E. Admin Monitoring — update `MonitoringAmalanView.vue` + `DetailAmalanUserView.vue`

- Tampilkan indikator tahajjud & Al-Qur'an di tabel
- Tampilkan badge "Berhalangan" untuk hari yang ditandai
- Hitung rata-rata skor baru (max 35)
- Filter: "Hari berhalangan" vs "Tidak hadir" (berhalangan dikecualikan dari konsistensi)

### 1F. Kalender & Progress — update `KalenderAmalanView.vue` + `ProgressAmalanView.vue`

- Kalender: warna hari berhalangan = abu-abu (bukan merah)
- Progress: tambah chart tahajjud & Al-Qur'an konsistensi

---

## BAGIAN 2: Fitur Penilaian ASA

### 2A. Database — tabel baru `penilaian_asa`

```
Migration 00013_penilaian_asa.sql

CREATE TABLE penilaian_asa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES profiles(id) NOT NULL,
  periode       text NOT NULL,            -- "2026-Genap" / "2026-Ganjil"

  -- Input Mentor (0-100)
  sikap_kedisiplinan  integer DEFAULT 0,  -- Bobot 20%
  keaktifan           integer DEFAULT 0,  -- Bobot 20%
  roadmap             integer DEFAULT 0,  -- Bobot 20% (Refleksi & Roadmap)
  posttest            integer DEFAULT 0,  -- Bobot 10%

  -- Auto-calculated (readonly, 0-100)
  kehadiran           integer DEFAULT 0,  -- Bobot 10%
  amalan_yaumi        integer DEFAULT 0,  -- Bobot 20%

  -- Computed
  total_nilai         numeric(5,2) GENERATED ALWAYS AS (
    (kehadiran * 0.10) + (posttest * 0.10) +
    (sikap_kedisiplinan * 0.20) + (amalan_yaumi * 0.20) +
    (roadmap * 0.20) + (keaktifan * 0.20)
  ) STORED,

  catatan_mentor text DEFAULT '',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),

  UNIQUE(user_id, periode)
);
```

**RLS Policy:**
- `user`: SELECT own penilaian
- `admin`: SELECT penilaian for users in their group
- `super_admin`: SELECT all, INSERT/UPDATE/DELETE all

### 2B. Auto-calculate — RPC function

```sql
CREATE FUNCTION calculate_penilaian(p_user_id uuid, p_periode text)
RETURNS void AS $$
  -- kehadiran: % kehadiran dari attendances (hari hadir / total sesi dalam periode)
  -- amalan_yaumi: rata-rata skor harian (skor/35 * 100) dari daily_worship_logs
  -- UPDATE penilaian_asa SET kehadiran = ..., amalan_yaumi = ...
$$ LANGUAGE plpgsql;
```

Mentor call `calculate_penilaian()` sebelum menyimpan → auto-fill `kehadiran` & `amalan_yaumi`.

### 2C. Bobot & Komponen

| Komponen | Bobot | Input | Sumber |
|----------|-------|-------|--------|
| Kehadiran | 10% | Otomatis | `attendances` table — % hadir dari total sesi |
| Posttest | 10% | Mentor | Form input (0-100) |
| Sikap & Kedisiplinan | 20% | Mentor | Form input (0-100) |
| Amal Yaumi | 20% | Otomatis | `daily_worship_logs` — rata-rata skor (skor/35×100) |
| Refleksi & Roadmap | 20% | Mentor | Form input (0-100) |
| Keaktifan | 20% | Mentor | Form input (0-100) |

### 2D. Composable — `usePenilaian.js`

```
Functions:
- getPenilaian(userId, periode)       → fetch satu record
- getPenilaianBatch(periode, groupFilter) → fetch semua untuk admin
- upsertPenilaian(payload)            → insert/update (mentor)
- calculateAuto(periode, groupFilter?) → trigger RPC untuk recalculate
- getRataRataKelas(periode)           → avg scores untuk super_admin dashboard
```

### 2E. Views

| View | Route | Role | Fungsi |
|------|-------|------|--------|
| `FormPenilaianView.vue` | `/penilaian/tambah` | admin | Form input: pilih anggota, input 4 field mentor, klik "Hitung Otomatis" → auto-fill kehadiran+amalan, simpan |
| `DaftarPenilaianView.vue` | `/penilaian` | admin | List anggota + nilai, filter periode, export |
| `RiwayatPenilaianView.vue` | `/riwayat-penilaian` | user | Lihat nilai sendiri + breakdown per komponen |
| `DashboardPenilaianView.vue` | `/dashboard/penilaian` | super_admin | Ranking kelas, distribusi nilai, export |

### 2F. Routes & Navigation

- **Admin**: tambah tab "Penilaian" di BottomNav
- **User**: tambah item di ProfilView atau route `/riwayat-penilaian`
- **Super_admin**: tambah tab "Penilaian" di dashboard navigation

---

## Urutan Pengerjaan

| Step | Task | File |
|------|------|------|
| 1 | Migration 00012 — tambah kolom `daily_worship_logs` | `supabase/migrations/00012_amalan_extension.sql` |
| 2 | Migration 00013 — tabel `penilaian_asa` + RPC | `supabase/migrations/00013_penilaian_asa.sql` |
| 3 | Update `amalanScore.js` — skor baru max 35 | `src/lib/amalanScore.js` |
| 4 | Update `useAmalan.js` — handle kolom baru | `src/composables/useAmalan.js` |
| 5 | Update `AmalanHarianView.vue` — form tahajjud + Qur'an + berhalangan | `src/views/user/amalan/AmalanHarianView.vue` |
| 6 | Update `KalenderAmalanView.vue` — warna berhalangan | `src/views/user/amalan/KalenderAmalanView.vue` |
| 7 | Update `ProgressAmalanView.vue` — chart baru | `src/views/user/amalan/ProgressAmalanView.vue` |
| 8 | Update `MonitoringAmalanView.vue` — kolom baru + badge berhalangan | `src/views/admin/MonitoringAmalanView.vue` |
| 9 | Update `DetailAmalanUserView.vue` — detail kolom baru | `src/views/admin/DetailAmalanUserView.vue` |
| 10 | Create `usePenilaian.js` | `src/composables/usePenilaian.js` |
| 11 | Create `FormPenilaianView.vue` | `src/views/admin/FormPenilaianView.vue` |
| 12 | Create `DaftarPenilaianView.vue` | `src/views/admin/DaftarPenilaianView.vue` |
| 13 | Create `RiwayatPenilaianView.vue` | `src/views/user/RiwayatPenilaianView.vue` |
| 14 | Create `DashboardPenilaianView.vue` | `src/views/super-admin/DashboardPenilaianView.vue` |
| 15 | Update router + BottomNav | `src/router/index.js`, `src/components/layout/BottomNav.vue` |
| 16 | Build + verify | `npm run build` |

---

## Catatan Penting

- **Tidak merusak data lama**: kolom baru punya `DEFAULT` → baris lama otomatis `'belum'`/`false`/`null`
- **Skor lama tetap valid**: max 25 → 35, tapi perhitungan lama masih proporsional
- **RLS policy**: user hanya CRUD sendiri, admin SELECT group sendiri
- **Berhalangan**: hari berhalangan **dikecualikan** dari konsistensi (bukan dihitung sebagai alpa)
- **Penilaian**: `total_nilai` adalah generated column — tidak perlu dihitung di frontend
