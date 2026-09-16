# PLAN: Bagian 2 — Penilaian ASA (Adzkia Spiritual Academy)

> **Konteks:** ASA adalah agenda tahunan, pelaksanaan 2 hari (2026), bisa 4 hari (2027). Penilaian ini untuk **ijazah/sertifikat** dengan grade A/B/C/D yang jelas dan transparan. Super admin menetapkan tanggal ASA, sistem otomatis tarik nilai kehadiran & amalan yaumi berdasarkan tanggal tersebut.

---

## 1. Komponen Penilaian (Final)

| No | Komponen | Bobot | Input | Sumber |
|---|---|---|---|---|
| 1 | Kehadiran | 10% | Otomatis | `attendances` — % hadir dari total sesi pada tanggal ASA |
| 2 | Posttest | 10% | Mentor | Form input (0–100) |
| 3 | Sikap & Kedisiplinan | 20% | Mentor | Form input (0–100) |
| 4 | Amal Yaumi | 20% | Otomatis | `daily_worship_logs` — rata-rata skor (skor/35×100) pada tanggal ASA |
| 5 | Refleksi & Roadmap | 20% | Mentor | Form input (0–100) |
| 6 | Keaktifan | 20% | Mentor | Form input (0–100) |

---

## 2. Analisis Codebase — Temuan Penting

| Aspek | Status | Catatan |
|---|---|---|
| `AMALAN_SKOR_MAX` | 35 | Sudah di-update di Bagian 1 |
| `hitungSkorHarian()` | ✅ | Sudah handle berhalangan (return 0) |
| `attendances` | ✅ | Ada `session_id`, `user_id`, `status` — bisa hitung kehadiran |
| `sessions` | ✅ | Ada `group_id`, `tanggal`, `is_open` — bisa filter sesi ASA |
| `daily_worship_logs` | ✅ | Sudah ada kolom `tahajjud`, `bacaan_quran`, `berhalangan` |
| `penilaian_asa` | ❌ Belum ada | Perlu dibuat |
| `asa_settings` | ❌ Belum ada | Perlu dibuat — config tanggal ASA oleh super admin |
| Router guards | ✅ | Sudah support `role: ['admin', 'super_admin']` |
| BottomNav | ✅ | Menu dinamis per role — tinggal tambah item |
| `useAttendance.js` | ⚠️ | Perlu tambah fungsi `getKehadiranPeriode()` |
| PDF export | ✅ | Sudah pakai jsPDF + autotable — bisa repackage |

---

## 3. Database

### 3.1 Tabel `asa_settings` — Konfigurasi Tanggal ASA

```sql
CREATE TABLE asa_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode     text NOT NULL UNIQUE,       -- "ASA-2026", "ASA-2027"
  nama_acara  text NOT NULL DEFAULT 'Adzkia Spiritual Academy',
  tahun       integer NOT NULL,           -- 2026, 2027
  tanggal     date[] NOT NULL,            -- {2026-03-15, 2026-03-16} — array tanggal pelaksanaan
  is_active   boolean DEFAULT true,       -- periode aktif (baru bisa diisi)
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS: hanya super_admin yang bisa CRUD
ALTER TABLE asa_settings ENABLE ROW LEVEL SECURITY;

CREATE policy "super_admin kelola asa_settings"
  ON asa_settings FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE policy "authenticated lihat asa_settings"
  ON asa_settings FOR SELECT
  USING (auth.role() = 'authenticated');
```

**Contoh data:**
```sql
INSERT INTO asa_settings (periode, nama_acara, tahun, tanggal)
VALUES ('ASA-2026', 'Adzkia Spiritual Academy', 2026, ARRAY['2026-07-10'::date, '2026-07-11'::date]);
```

### 3.2 Tabel `penilaian_asa`

```sql
CREATE TABLE penilaian_asa (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES profiles(id) NOT NULL,
  periode           text NOT NULL DEFAULT 'ASA-2026',

  -- Input Mentor (0-100)
  sikap_kedisiplinan  integer DEFAULT 0 CHECK (sikap_kedisiplinan >= 0 AND sikap_kedisiplinan <= 100),
  keaktifan           integer DEFAULT 0 CHECK (keaktifan >= 0 AND keaktifan <= 100),
  roadmap             integer DEFAULT 0 CHECK (roadmap >= 0 AND roadmap <= 100),
  posttest            integer DEFAULT 0 CHECK (posttest >= 0 AND posttest <= 100),

  -- Auto-calculated (0-100)
  kehadiran           integer DEFAULT 0,
  amalan_yaumi        integer DEFAULT 0,

  -- Computed (generated column)
  total_nilai         numeric(5,2) GENERATED ALWAYS AS (
    (kehadiran * 0.10) + (posttest * 0.10) +
    (sikap_kedisiplinan * 0.20) + (amalan_yaumi * 0.20) +
    (roadmap * 0.20) + (keaktifan * 0.20)
  ) STORED,

  catatan_mentor      text DEFAULT '',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE(user_id, periode)
);

ALTER TABLE penilaian_asa ENABLE ROW LEVEL SECURITY;
```

### 3.3 Grade Mapping

| Grade | Rentang | Keterangan |
|---|---|---|
| A | 90 – 100 | Sangat Memuaskan |
| B | 80 – 89 | Memuaskan |
| C | 70 – 79 | Cukup |
| D | < 70 | Perlu Perbaikan |

### 3.4 RPC: `calculate_penilaian(p_user_id, p_periode)`

```sql
CREATE OR REPLACE FUNCTION calculate_penilaian(p_user_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_tanggal date[];
  v_group_id uuid;
  v_total_sesi bigint;
  v_hadir bigint;
  v_log record;
  v_score numeric;
  v_total_score numeric := 0;
  v_total_hari integer := 0;
  v_kehadiran integer;
  v_amalan integer;
BEGIN
  -- 1. Ambil tanggal ASA dari asa_settings
  SELECT tanggal INTO v_tanggal
  FROM asa_settings
  WHERE periode = p_periode;

  IF v_tanggal IS NULL OR array_length(v_tanggal, 1) = 0 THEN
    RAISE EXCEPTION 'ASA periode % tidak ditemukan atau tanggal belum diatur', p_periode;
  END IF;

  -- 2. Ambil group_id user
  SELECT group_id INTO v_group_id FROM profiles WHERE id = p_user_id;

  -- 3. Hitung kehadiran: sesi pada tanggal ASA yang user hadiri
  SELECT count(*) INTO v_total_sesi
  FROM sessions s
  WHERE s.group_id = v_group_id
    AND s.tanggal = ANY(v_tanggal);

  SELECT count(*) INTO v_hadir
  FROM attendances a
  JOIN sessions s ON s.id = a.session_id
  WHERE a.user_id = p_user_id
    AND a.status = 'hadir'
    AND s.tanggal = ANY(v_tanggal);

  v_kehadiran := CASE
    WHEN v_total_sesi = 0 THEN 0
    ELSE round((v_hadir::numeric / v_total_sesi) * 100)
  END;

  -- 4. Hitung amalan_yaumi: rata-rata skor harian pada tanggal ASA
  FOR v_log IN
    SELECT * FROM daily_worship_logs
    WHERE user_id = p_user_id
      AND tanggal = ANY(v_tanggal)
  LOOP
    v_total_hari := v_total_hari + 1;

    IF v_log.berhalangan THEN
      v_score := 0;
    ELSE
      v_score := 0;
      -- Shalat wajib: TW=4, TL=2, Q=1
      IF v_log.shalat_subuh = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_subuh = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_subuh = 'qadha' THEN v_score := v_score + 1;
      END IF;
      IF v_log.shalat_dzuhur = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_dzuhur = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_dzuhur = 'qadha' THEN v_score := v_score + 1;
      END IF;
      IF v_log.shalat_ashar = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_ashar = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_ashar = 'qadha' THEN v_score := v_score + 1;
      END IF;
      IF v_log.shalat_maghrib = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_maghrib = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_maghrib = 'qadha' THEN v_score := v_score + 1;
      END IF;
      IF v_log.shalat_isya = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_isya = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_isya = 'qadha' THEN v_score := v_score + 1;
      END IF;
      -- Dhuha: +3
      IF v_log.shalat_dhuha THEN v_score := v_score + 3; END IF;
      -- Rakaat: +min(rakaat, 2)
      IF v_log.jumlah_rakaat IS NOT NULL THEN
        v_score := v_score + least(v_log.jumlah_rakaat, 2);
      END IF;
      -- Tahajjud: TW=5, TL=3, Q=1
      IF v_log.tahajjud = 'tepat_waktu' THEN v_score := v_score + 5;
      ELSIF v_log.tahajjud = 'terlambat' THEN v_score := v_score + 3;
      ELSIF v_log.tahajjud = 'qadha' THEN v_score := v_score + 1;
      END IF;
      -- Bacaan Qur'an: +5
      IF v_log.bacaan_quran IS NOT NULL AND jsonb_object_keys(v_log.bacaan_quran) IS NOT NULL THEN
        v_score := v_score + 5;
      END IF;
    END IF;

    v_total_score := v_total_score + v_score;
  END LOOP;

  v_amalan := CASE
    WHEN v_total_hari = 0 THEN 0
    ELSE round((v_total_score / v_total_hari / 35) * 100)
  END;

  -- 5. Update / Insert penilaian
  INSERT INTO penilaian_asa (user_id, periode, kehadiran, amalan_yaumi, updated_at)
  VALUES (p_user_id, p_periode, v_kehadiran, v_amalan, now())
  ON CONFLICT (user_id, periode)
  DO UPDATE SET kehadiran = EXCLUDED.kehadiran,
                amalan_yaumi = EXCLUDED.amalan_yaumi,
                updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.5 RPC: `get_penilaian_with_profile(p_periode, p_group_id?)`

```sql
-- Untuk admin/super_admin: fetch penilaian + nama/nim/kelompok
CREATE OR REPLACE FUNCTION get_penilaian_with_profile(
  p_periode text,
  p_group_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nama text,
  nim text,
  nama_kelompok text,
  sikap_kedisiplinan integer,
  keaktifan integer,
  roadmap integer,
  posttest integer,
  kehadiran integer,
  amalan_yaumi integer,
  total_nilai numeric,
  catatan_mentor text,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.user_id, pr.nama, pr.nim, g.nama_kelompok,
    p.sikap_kedisiplinan, p.keaktifan, p.roadmap, p.posttest,
    p.kehadiran, p.amalan_yaumi, p.total_nilai, p.catatan_mentor,
    p.updated_at
  FROM penilaian_asa p
  JOIN profiles pr ON pr.id = p.user_id
  LEFT JOIN groups g ON g.id = pr.group_id
  WHERE p.periode = p_periode
    AND (p_group_id IS NULL OR pr.group_id = p_group_id)
  ORDER BY p.total_nilai DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.6 RLS Policy — penilaian_asa

```sql
-- user: SELECT own
CREATE policy "user lihat penilaian sendiri"
  ON penilaian_asa FOR SELECT
  USING (auth.uid() = user_id);

-- admin: SELECT for users in their group
CREATE policy "admin lihat penilaian kelompok"
  ON penilaian_asa FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles target ON target.id = penilaian_asa.user_id
      WHERE p.id = auth.uid() AND p.role = 'admin'
      AND target.group_id = p.group_id
    )
  );

-- super_admin: full access
CREATE policy "super_admin kelola penilaian"
  ON penilaian_asa FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));
```

---

## 4. Grading Logic — `lib/grading.js`

```js
// lib/grading.js — NEW FILE
export const GRADE_MAP = [
  { min: 90, grade: 'A', label: 'Sangat Memuaskan' },
  { min: 80, grade: 'B', label: 'Memuaskan' },
  { min: 70, grade: 'C', label: 'Cukup' },
  { min: 0,  grade: 'D', label: 'Perlu Perbaikan' }
]

export function getGrade(score) {
  const s = Math.round(score * 100) / 100
  for (const g of GRADE_MAP) {
    if (s >= g.min) return { score: s, grade: g.grade, label: g.label }
  }
  return { score: s, grade: 'D', label: 'Perlu Perbaikan' }
}
```

---

## 5. Composable — `usePenilaian.js`

| Fungsi | Deskripsi |
|---|---|
| `getAsaSettings()` | Fetch semua periode ASA |
| `getAsaActive()` | Fetch periode ASA yang aktif (is_active=true) |
| `createAsaSettings(payload)` | Super admin: buat periode baru |
| `updateAsaSettings(id, payload)` | Super admin: update tanggal/periode |
| `getPenilaian(userId, periode)` | Fetch satu record untuk user tertentu |
| `getPenilaianBatch(periode, groupFilter?)` | Fetch semua untuk admin — via RPC `get_penilaian_with_profile` |
| `upsertPenilaian(payload)` | Insert/update (hanya kolom mentor input + catatan) |
| `calculateAuto(userId, periode)` | Trigger RPC `calculate_penilaian` → return updated record |
| `getRataRataKelas(periode)` | RPC/SQL aggregate untuk dashboard super_admin |

---

## 6. Views

### 6.1 PengaturanASAView.vue — `/dashboard/asa` (Super Admin)

**Role:** super_admin
**Fitur:**
- Lihat semua periode ASA (tabel: periode, tahun, tanggal, is_active)
- Buat periode baru: input nama_acara, tahun, pilih tanggal (date array, min 1 tanggal)
- Toggle `is_active` — hanya 1 periode yang aktif
- Edit tanggal (jika belum ada penilaian yang diisi)
- Tidak bisa hapus jika sudah ada penilaian

**Layout:**
- Card list periode
- Form create/edit: input fields + date picker (multi-select tanggal)
- Toggle switch untuk is_active

### 6.2 FormPenilaianView.vue — `/penilaian/tambah/:userId?`

**Role:** admin
**Flow:**
1. Jika ada `userId` dari route → mode edit (load data existing)
2. Jika tidak → mode tambah baru
3. Pilih anggota dari dropdown (filter group_id admin)
4. Periode auto-fill dari periode ASA aktif
5. Input 4 field mentor: sikap_kedisiplinan, keaktifan, roadmap, posttest (input 0–100)
6. Input catatan_mentor (textarea)
7. Klik "Hitung Otomatis" → trigger RPC `calculate_penilaian` → tampilkan kehadiran & amalan_yaumi
8. Preview total_nilai + grade (computed column — tampilkan dari response)
9. Simpan

**Layout:**
- Mobile-first card layout
- Card profil anggota di atas (nama, NIM, kelompok)
- 4 input fields + 1 textarea
- "Hitung Otomatis" button (secondary)
- "Simpan" button (primary)
- Preview card di bawah: kehadiran, amalan_yaumi, total, grade

### 6.3 DaftarPenilaianView.vue — `/penilaian`

**Role:** admin
**Fitur:**
- Tabel daftar anggota + nilai
- Filter: periode (dari asa_settings)
- Kolom: No | Nama | NIM | Kehadiran | Sikap | Keaktifan | Roadmap | Posttest | Amalan | Total | Grade
- Sort by total_nilai (default desc)
- Export PDF (sama style dengan MonitoringAmalanView)
- Klik baris → edit (navigasi ke FormPenilaianView dengan data existing)

### 6.4 RiwayatPenilaianView.vue — `/riwayat-penilaian`

**Role:** user
**Fitur:**
- Lihat nilai sendiri (periode terakhir)
- Dropdown periode jika multi-period
- Breakdown per komponen:
  - Card per komponen: nama komponen, bobot, nilai (skor/100), grade
  - Progress bar per komponen
- Total + grade besar di atas
- Download PDF (optional)

### 6.5 DashboardPenilaianView.vue — `/dashboard/penilaian`

**Role:** super_admin
**Fitur:**
- Ringkasan: rata-rata kelas, distribusi grade (A/B/C/D pie/bar)
- Tabel ranking: No | Nama | NIM | Kelompok | Total | Grade
- Filter: periode, kelompok
- Export PDF (ranking list)
- Klik baris → navigasi ke DetailAmalanUserView atau DetailPenilaianView

---

## 7. Navigation Updates

### Admin BottomNav — tambah "Penilaian"
```js
{ label: 'Penilaian', icon: icons.document, route: '/penilaian' }
```

### User — RiwayatPenilaianView
- Route: `/riwayat-penilaian`
- Akses: dari ProfilView (tombol "Lihat Penilaian ASA") — bukan tab baru

### Super Admin — tambah "ASA" + "Penilaian"
```js
{ label: 'ASA', icon: icons.settings, route: '/dashboard/asa' },
{ label: 'Penilaian', icon: icons.document, route: '/dashboard/penilaian' }
```

---

## 8. PDF Export — Layout Akademis (1 Halaman)

### Format Landscape A4

```
┌─────────────────────────────────────────────────────────┐
│  [Logo/Header]     LAPORAN PENILAIAN ASA 2026           │
│  Adzkia Spiritual Academy                               │
│                                                         │
│  Nama: ...    NIM: ...    Kelompok: ...                 │
│  Periode: ASA-2026 (10-11 Juli 2026)                   │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ No │ Komponen            │ Bobot │ Nilai │ Nilai    ││
│  │    │                     │       │ Input │ Akhir    ││
│  ├─────────────────────────────────────────────────────┤│
│  │ 1  │ Kehadiran           │ 10%   │   -   │  90.00  ││
│  │ 2  │ Posttest            │ 10%   │  85   │  85.00  ││
│  │ 3  │ Sikap & Kedisiplinan│ 20%   │  90   │  90.00  ││
│  │ 4  │ Amal Yaumi          │ 20%   │   -   │  82.50  ││
│  │ 5  │ Refleksi & Roadmap  │ 20%   │  88   │  88.00  ││
│  │ 6  │ Keaktifan           │ 20%   │  92   │  92.00  ││
│  ├─────────────────────────────────────────────────────┤│
│  │        TOTAL NILAI AKHIR              │  87.50     ││
│  │        GRADE                           │  B         ││
│  │        KETERANGAN                      │  Memuaskan ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  Catatan Mentor: ...                                    │
│                                                         │
│  Tanggal Cetak: ...          Tanda Tangan Murabbi       │
└─────────────────────────────────────────────────────────┘
```

**Catatan teknis PDF:**
- Header hijau (#16A34A) — konsisten dengan theme app
- Tabel: alternating row (hijau muda), bold header
- Total + Grade: highlight box
- Font: Helvetica (built-in jsPDF)
- Landscape A4 — cukup 1 halaman untuk 6 komponen

---

## 9. Urutan Pengerjaan

| Step | Task | File | Risk |
|---|---|---|---|
| 1 | Migration 00013 — asa_settings + penilaian_asa + RLS + RPCs | `supabase/migrations/00013_penilaian_asa.sql` | MEDIUM — tabel baru + SQL logic |
| 2 | Create `lib/grading.js` | `src/lib/grading.js` | LOW — pure function |
| 3 | Create `composables/usePenilaian.js` | `src/composables/usePenilaian.js` | LOW — mirip useAmalan |
| 4 | Create PengaturanASAView.vue | `src/views/super-admin/PengaturanASAView.vue` | LOW — CRUD settings |
| 5 | Create FormPenilaianView.vue | `src/views/admin/FormPenilaianView.vue` | MEDIUM — form + RPC |
| 6 | Create DaftarPenilaianView.vue | `src/views/admin/DaftarPenilaianView.vue` | LOW — tabel mirip |
| 7 | Create RiwayatPenilaianView.vue | `src/views/user/RiwayatPenilaianView.vue` | LOW — read-only |
| 8 | Create DashboardPenilaianView.vue | `src/views/super-admin/DashboardPenilaianView.vue` | MEDIUM — chart + ranking |
| 9 | Update router | `src/router/index.js` | LOW — tambah 5 routes |
| 10 | Update BottomNav | `src/components/layout/BottomNav.vue` | LOW — tambah 3 menu items |
| 11 | Update ProfilView (tombol Penilaian) | `src/views/user/ProfilView.vue` | LOW — tambah tombol |
| 12 | Build + verify | `npm run build` | — |

---

## 10. Risk Mitigation

| Risk | Dampak | Mitigasi |
|---|---|---|
| ASA tanggal belum diatur | RPC gagal | Validasi di frontend: cek `asa_settings` aktif sebelum simpan |
| RPC `calculate_penilaian` ada bug | Kehadiran/amalan salah | Test dengan data manual dulu, log output SQL |
| Generated column `total_nilai` error | Insert gagal | Validasi di frontend: pastikan semua integer 0-100 |
| PDF 1 halaman overflow | Tabel terpotong | Gunakan font kecil (7-8pt), landscape, test dengan 6 komponen |
| Navigation breaking | User tidak bisa akses | Test semua role setelah update BottomNav |
| RLS policy bocor | User lihat data orang lain | Test: login sebagai user, coba akses penilaian orang lain → harus ditolak |
| Amalan score lama (max 25) | amalan_yaumi salah | Migration 00012 sudah max 35, data lama tetap valid (proporsional) |
| Super admin salah set tanggal | Data penilaian salah | Tidak bisa edit tanggal jika sudah ada penilaian terisi |

---

## 11. Design Decisions

1. **ASA tanggal ditetapkan super admin** — stored di `asa_settings`, array tanggal fleksibel (2–4 hari)
2. **Periode = `"ASA-YYYY"`** — format konsisten, satu periode = satu pelaksanaan
3. **Grade A/B/C/D dengan threshold tetap** — tidak perlu config, cukup di `lib/grading.js`
4. **Total_nilai = generated column** — dihitung di DB, tidak perlu frontend compute
5. **User akses via ProfilView** — bukan tab baru, BottomNav user sudah max 5
6. **PDF 1 halaman landscape** — jsPDF + autotable, font 7-8pt, alternating rows
7. **RPC calculate_penilaian** — mentor klik "Hitung Otomatis" sebelum simpan
8. **Tidak tambah dependency baru** — semua pakai jsPDF + autotable yang sudah ada

---

## 12. Verification Checklist

- [ ] Migration 00013 applied tanpa error
- [ ] asa_settings: super admin bisa buat/edit periode
- [ ] RLS policy: user hanya lihat sendiri
- [ ] RLS policy: admin hanya lihat kelompok
- [ ] RLS policy: super_admin full access
- [ ] RPC calculate_penilaian return kehadiran & amalan_yaumi benar
- [ ] FormPenilaianView: simpan + hitung otomatis berfungsi
- [ ] DaftarPenilaianView: tabel + filter + export berfungsi
- [ ] RiwayatPenilaianView: user lihat nilai sendiri
- [ ] DashboardPenilaianView: ranking + distribusi grade
- [ ] PengaturanASAView: CRUD tanggal ASA berfungsi
- [ ] PDF export: layout rapi 1 halaman, tidak overflow
- [ ] Navigation: semua role bisa akses route yang benar
- [ ] `npm run build` tanpa error
