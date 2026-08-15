# Report Analisa Sistem & Integrasi Per Role

**Proyek:** Aplikasi Absensi Liqa QR (`aplikasi-absensi-qr`)
**Tanggal:** 15 Agustus 2026
**Cakupan:** Arsitektur per role (User, Admin/Murabbi, Super Admin), integrasi frontend ↔ Supabase (RLS/RPC/Edge Function/Realtime), dan daftar perbaikan.

---

## 1. Ringkasan Arsitektur

| Role | Halaman | Data yang diakses | Kanal akses |
|---|---|---|---|
| **User** | QR Saya, Riwayat, Profil, Al-Quran, Amalan, Catatan | `profiles` (diri), `attendances` (diri), `sessions` (kelompoknya), `quran_bookmarks`, `daily_worship_logs`, `notes` (privat) | PostgREST langsung (RLS) |
| **Admin/Murabbi** | Beranda, Scan Absen, Anggota Saya, Tambah Anggota, Riwayat Sesi, Monitoring Amalan | `groups` (kelompoknya), `sessions` (kelompoknya), `attendances` (isi + insert), `profiles` (anggota), `daily_worship_logs` (read) | PostgREST langsung + RPC `get_profile_by_token` |
| **Super Admin** | Dashboard, Kelola Murabbi/Kelompok/Akun, Approval, Laporan, Pengaturan, Monitoring Amalan | Semua tabel | PostgREST langsung + RPC `approve_user` + Edge Function `admin-create-user` |

**Alur utama (happy path yang benar):**
1. User daftar → trigger `handle_new_user` buat `profiles` (role `user`, status `pending`).
2. Super Admin setujui via RPC `approve_user` (status → `aktif`).
3. Admin/Murabbi menambah user ke kelompoknya (`profiles.group_id`).
4. Admin buka sesi (`sessions`, unik 1 sesi terbuka/kelompok) → scan QR user via RPC `get_profile_by_token` → insert `attendances` (unique `session_id+user_id`).
5. User lihat riwayat/QR; Super Admin monitor lewat dashboard/laporan.

---

## 2. Temuan & Prioritas Perbaikan

Urutan = dampak bisnis (data hilang / fitur mati / akses salah) lalu biaya perbaikan.

### 🔴 P1 — Kritis (fitur mati / alur onboarding buntu)

**1. User tidak punya policy SELECT di tabel `sessions` → seluruh riwayat & statistik kehadiran user kosong.**
- Lokasi: `supabase/migrations/00001_init.sql:105` & `00002_fix_rls_recursion.sql:36` — satu-satunya policy `sessions` adalah "admin kelola sesi kelompoknya" (`role in ('admin','super_admin')`).
- Dampak: semua query user yang `join sessions!inner` ditolak RLS: `src/composables/useAttendance.js:12`, `src/views/user/QrSayaView.vue:37-40,75-81`. Akibatnya riwayat kehadiran, statistik, dan banner "sesi berlangsung" user **semuanya kosong** meski data ada.
- ✅ **SELESAI** (`00007_fix_p1_rls.sql`) — policy `"user lihat sesi kelompoknya"`:
  ```sql
  create policy "user lihat sesi kelompoknya" on sessions for select
    using (exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.group_id = sessions.group_id
    ));
  ```
  **Terverifikasi live** (simulasi role `authenticated` + `request.jwt.claims`): user Zainal hanya melihat 5 sesi kelompoknya (Al-Furqan); sesi kelompok lain (`5fd0fa9d`) tidak tampak.

**2. Policy UPDATE "admin assign anggota tanpa grup" gagal saat `group_id` diisi → admin tidak bisa menambah anggota ke kelompok.**
- Lokasi: `00002_fix_rls_recursion.sql:25-30`. Policy hanya punya `using (... and profiles.group_id is null)`. Untuk UPDATE, jika `with check` tidak ditulis, Postgres memakai ekspresi `using` sebagai `with check` — baris hasil update harus tetap `group_id is null`. Saat admin men-set `group_id` (bukan null), **baris baru melanggar policy → RLS menolak**. Selain itu `using` mensyaratkan baris **lama** juga `group_id is null`, sehingga pindah kelompok anggota yang sudah ter-assign berakhir senyap (0 baris).
- Dampak: `src/views/admin/TambahAnggotaView.vue:47-52` (tambah anggota) dan `src/views/super-admin/KelolaMurabbiView.vue:46-50,61-68` (promosi murabbi + pindah kelompok) gagal.
- ✅ **SELESAI** (`00007_fix_p1_rls.sql`) — policy lama di-drop, diganti `"admin kelola keanggotaan"` (restriksi `group_id is null` di `using` juga dihapus, karena menahan pindah anggota yang sudah ber-grup):
  ```sql
  create policy "admin kelola keanggotaan"
    on profiles for update
    using (get_current_user_role() in ('admin','super_admin'))
    with check (get_current_user_role() in ('admin','super_admin'));
  ```
  **Terverifikasi live** (simulasi admin Ujang): assign anggota baru (group null → grup) berhasil `RETURNING`; pindahkan anggota sudah ber-grup ke grup lain juga berhasil.

**3. Duplikasi sumber kebenaran relasi Admin↔Kelompok (`groups.murabbi_id` vs `profiles.group_id`).**
- Lokasi: `KelolaKelompokView.vue:48-74` hanya set `groups.murabbi_id`; `KelolaMurabbiView.vue:61-68` hanya set `profiles.group_id`.
- Dampak: admin yang ditetapkan lewat form Kelola Kelompok tidak punya `group_id` → halaman Beranda/ScanAbsen menampilkan "Belum Ditugaskan" dan tidak bisa membuka sesi (logika admin memakai `profile.group_id`, bukan `murabbi_id`).
- ✅ **SELESAI** — sumber kebenaran ditetapkan `profiles.group_id` (dipakai semua logika admin + RLS):
  1. `00007_fix_p1_rls.sql` — trigger `trg_sync_murabbi` (setelah `update of role, group_id`): `groups.murabbi_id` diturunkan dari `profiles.group_id` (clear pointer lama, set pointer baru). Divergensi apa pun yang ditulis langsung ke DB otomatis tersembunyi.
  2. `KelolaKelompokView.vue` — `handleSave` kini **juga** menyinkronkan `profiles.group_id` murabbi (clear murabbi lama bila diganti, set murabbi baru), insert group mengembalikan `id` (`select('id').single()`).
  **Terverifikasi live**: perbaiki data nyata (admin "Desnia Zola" sebagai murabbi Kelompok Zola tanpa `group_id` → kini `group_id` terisi, `groups.murabbi_id` konsisten); simulasi pindah kelompok → `murabbi_id` Kelompok Zola di-clear dan Kelompok 9 Naga di-set.

### 🟠 P2 — Tinggi (data hilang / keamanan / realtime)

**4. Data registrasi (NIM, prodi, kelas, angkatan, no_hp) hilang di produksi.**
- Lokasi: `src/views/auth/RegisterView.vue:31-35` hanya mengirim `nama` ke `user_metadata`; field lain ditulis lewat `authStore.updateProfile` setelah signup.
- Masalah: `updateProfile` butuh sesi aktif. `config.toml` lokal set `enable_confirmations = false` (signup langsung dapat sesi → lolos). Di Supabase Cloud default **email confirmation aktif → tidak ada sesi → update ditolak RLS** → field tambahan hilang (Approval menampilkan NIM/prodi kosong). Loop retry 3×600ms di `authStore.js:66-77` adalah tambalan gejala.
- ✅ **SELESAI** (`00008_fix_p2.sql` + app) — semua field dikirim via `options.data` (user_metadata) di `authStore.register`; trigger `handle_new_user` diisi ulang untuk membaca `raw_user_meta_data` (nama, nim, prodi, kelas, angkatan, no_hp). `RegisterView` tidak lagi memanggil `updateProfile` pasca-signup; retry loop dihapus. **Terverifikasi live**: insert `auth.users` dengan metadata lengkap → row `profiles` terisi semua kolom. Catatan: data lama yang sudah hilang tidak bisa di-backfill otomatis (tidak pernah tersimpan); user lama perlu isi ulang via Profil.

**5. Admin/super_admin bisa membaca `qr_token` semua user langsung via SELECT policy — RPC `get_profile_by_token` bisa dilewati.**
- Lokasi: `00001_init.sql:81-85` (policy select mengizinkan admin/super_admin melihat semua kolom `profiles`, termasuk `qr_token`). Ini bertentangan dengan AGENTS.md §7.1 yang mewajibkan akses token hanya via RPC.
- ✅ **SELESAI** (`00008_fix_p2.sql` + app) — `revoke select` level tabel lalu re-grant per kolom TANPA `qr_token` (revoke kolom saja tidak cukup: grant level tabel menimpanya). RPC baru `get_my_qr_token()` (security definer) untuk user mengambil token sendiri; `QrSayaView` memakainya. `authStore.fetchProfile` diubah dari `select('*')` ke daftar kolom eksplisit (PostgREST `select=*` ikut menyertakan kolom ter-revoke → error 42501). **Terverifikasi live**: `has_column_privilege` qr_token = FALSE (anon & authenticated), REST `select=qr_token` ditolak, kolom lain tetap terbaca; `get_my_qr_token()` mengembalikan token user sendiri.

**6. Insert `attendances` tidak di-scope ke kelompok → admin grup A bisa mengabsen ke sesi grup B / non-anggota.**
- Lokasi: `00002_fix_rls_recursion.sql:51-53` — `with check` hanya cek role, tidak cek `sessions.group_id = caller.group_id`. Ditambah `get_profile_by_token` (`00004:12-30`) mengembalikan anggota grup mana pun.
- ✅ **SELESAI** (`00008_fix_p2.sql`) — policy `"admin catat kehadiran"` di-rewrite: `with check` memvalidasi (a) sesi = kelompok caller (atau super_admin), (b) anggota yang diabsen = kelompok sesi. RPC `get_profile_by_token` dibatasi: admin hanya dapat profil anggota dengan `group_id = group_id`-nya (super_admin semua); admin tanpa grup → kosong. **Terverifikasi live**: insert ke sesi grup lain → error `42501 RLS`; insert sesi sendiri → sukses; RPC cross-group → 0 baris, own-group → 1 baris.

**7. Realtime rusak untuk `attendances` (dan sessions/groups) — hanya `daily_worship_logs` yang masuk publikasi.**
- Lokasi: `00006_new_modules.sql:111` menambah hanya `daily_worship_logs` ke `supabase_realtime`. Tabel lain tidak pernah ditambahkan.
- Dampak: counter "terabsen" realtime di `BerandaView.vue:186-193` dan reload `MonitoringAmalanView.vue:288-293` tidak pernah menerima event.
- ✅ **SELESAI** (`00008_fix_p2.sql`) — `alter publication supabase_realtime add table public.attendances, public.sessions;`. **Terverifikasi live**: publikasi kini berisi `attendances`, `daily_worship_logs`, `sessions`.

**8. Tidak ada policy UPDATE/DELETE di `attendances` → kesalahan scan (misal salah klik "alpa") tidak bisa dikoreksi.**
- Lokasi: `00001_init.sql:117-127`, `00002:47-53` — hanya SELECT (user) dan INSERT (admin).
- ✅ **SELESAI** (`00008_fix_p2.sql`) — policy `"admin koreksi kehadiran"` (UPDATE) dan `"admin hapus kehadiran"` (DELETE), keduanya `using` di-scope ke kelompok caller (super_admin semua). **Terverifikasi live**: update/delete absen sesi grup sendiri → berhasil; sesi grup lain → 0 baris (diblokir). Catatan: belum ada UI koreksi di frontend — policy sudah siap untuk fitur tersebut.

### 🟡 P3 — Sedang (inkonsistensi & UX lintas role)

**9. Perhitungan skor amalan tidak konsisten antar halaman.** ✅
- `useAmalan.js:85-97` (`hitungSkorHarian`, max 25, **termasuk rakaat**) vs `MonitoringAmalanView.vue:65-76` & `DetailAmalanUserView.vue:88-99` (max 23, **tanpa rakaat**). User melihat angka berbeda dari yang dilihat admin.
- Fix: helper tunggal `src/lib/amalanScore.js` (`hitungSkorHarian` → skor numerik max `AMALAN_SKOR_MAX = 25`, termasuk rakaat; `skorHarianPct`). `useAmalan.js` mendelagasikan ke helper (API objek `{total, max, score, pct}` dipertahankan untuk view user), `MonitoringAmalanView.vue` & `DetailAmalanUserView.vue` memakai helper langsung (`maxSkor: AMALAN_SKOR_MAX`, bukan `23`).

**10. Super Admin tidak bisa akses Laporan & Pengaturan di mobile.** ✅
- Lokasi: `BottomNav.vue:63-70` — `menuMap.super_admin` tidak memuat `/dashboard/laporan` dan `/dashboard/pengaturan` (hanya muncul di sidebar desktop, `BottomNav.vue:173-195`).
- Fix: tambahkan ke `menuMap.super_admin` (mobile bottom nav); blok link ekstra di sidebar desktop dihapus (menu kini satu sumber kebenaran).

**11. Label "Sesi Hari Ini" di Dashboard sebenarnya semua sesi terbuka (tanpa filter tanggal).** ✅
- Lokasi: `DashboardView.vue:34` — `.eq('is_open', true)` tanpa filter `tanggal = today`.
- Fix: tambah `.eq('tanggal', today)`.

**12. Filter status Laporan menyesatkan.** ✅
- Lokasi: `LaporanView.vue:32-35` — filter memilih sesi yang **memuat minimal satu** anggota ber-status X, tetapi tetap menampilkan seluruh anggota sesi itu.
- Fix: saat `filterStatus` aktif, daftar `anggota` per sesi ikut difilter & hitungan `hadir/izin/alpa/total` dihitung ulang dari anggota yang tampil (summary konsisten dengan detail).

**13. N+1 query yang meledak di monitor/laporan.** ✅ (digabung, tanpa subquery)
- `DashboardView.vue` (loop 2 query/kelompok) → 3 query tetap: semua sesi (last-5 per grup dihitung di JS), `attendances` di-`in` session id, `profiles.group_id` untuk hitung anggota.
- `RiwayatSesiView.vue` (query per sesi) → satu query `attendances` dengan `.in('session_id', ids)`.
- `KelolaKelompokView.vue` (query per kelompok) → satu query `profiles(group_id)` + hitung di JS.
- `AnggotaSayaView.vue` (query per anggota saat expand) → prefetch semua riwayat dengan `.in('user_id', ids)` sekali; expand hanya membalik tampilan.
- Catatan: pagination masih belum ada (limit `5`/`20`), tetap prioritas rendah.

### ⚪ P4 — Info / catatan

- `admin-create-user` (Edge Function, service_role) sudah memvalidasi caller super_admin & men-rollback saat gagal (`index.ts:79-112`) — sudah benar.
- `approve_user` / `get_profile_by_token` sudah aman (security definer + cek `auth.uid()`) — sudah benar.
- `one_open_session_per_group` dan `unique(session_id,user_id)` sudah mencegah duplikasi di DB — sudah benar.
- Route guard per role sudah benar & konsisten (`router/index.js`).
- `notes` privat penuh (tanpa policy admin) — sesuai desain.

### 🔒 Verifikasi Isolasi Fitur Catatan (Notes) — hasil: AMAN, tidak bocor

**DB (RLS):** `00006_new_modules.sql:81-87` — `notes` RLS enabled, satu-satunya policy `"user kelola catatan sendiri"` = `auth.uid() = user_id` untuk `FOR ALL` (dengan `with check`). Tidak ada policy admin/super_admin (privasi penuh). `notes` tidak ditambahkan ke `supabase_realtime` → tidak ada kebocoran via realtime.

**App:** tabel `notes` hanya diakses dari `src/composables/useCatatan.js` (5 query; grep: tidak ada view/edge function lain yang menyentuhnya).
- `fetchAll`: `.eq('user_id', userId)` dengan `userId` selalu `authStore.user.id` (`DaftarCatatanView.vue:61`).
- `create`/`update`: payload membawa `user_id: authStore.user.id` (`FormCatatanView.vue:42`) → `with check` menolak pemalsuan ke user lain.
- `fetchOne`/`remove`: hanya filter `id` (id dari `route.params` bisa dimanipulasi user) — **dilindungi penuh oleh RLS**; akses ke id milik orang lain mengembalikan kosong → tampil "Catatan tidak ditemukan".

**Kontras (sesuai desain):** `daily_worship_logs` (Amalan) sengaja dapat dibaca admin/super_admin (untuk Monitoring Amalan, `00006:57-65`); `notes` 100% privat.

**Hardening opsional (bukan bug bocor):**
1. `fetchOne`, `update`, `remove` mengandalkan RLS sebagai satu-satunya pagar (tanpa filter `user_id` eksplisit). Tambahkan `.eq('user_id', authStore.user.id)` sebagai defense-in-depth bila migrasi belum terpasang / RLS nonaktif di prod.
2. Pastikan migrasi `00006` benar-benar ter-apply di produksi — karena keamanan notes bergantung penuh pada RLS ini.

---

## 3. Daftar Perbaikan Prioritas (eksekusi)

| # | Aksi | File | Effort | Status |
|---|---|---|---|---|
| 1 | Policy SELECT `sessions` untuk user anggota | `00007_fix_p1_rls.sql` | S | ✅ |
| 2 | `with check` pada policy assign anggota | `00007_fix_p1_rls.sql` | S | ✅ |
| 3 | Sinkronkan `groups.murabbi_id` ↔ `profiles.group_id` | `KelolaKelompokView` + DB | M | ✅ |
| 4 | Registrasi: simpan field via `user_metadata` + trigger; hapus retry loop | `RegisterView`, `authStore`, `00008_fix_p2.sql` | S | ✅ |
| 5 | Batasi kolom `qr_token` agar hanya via RPC | `00008_fix_p2.sql` | S | ✅ |
| 6 | Scope insert absen & lookup token ke kelompok caller | `00008_fix_p2.sql` | M | ✅ |
| 7 | Tambah `attendances`, `sessions` ke `supabase_realtime` | `00008_fix_p2.sql` | S | ✅ |
| 8 | Policy UPDATE/DELETE `attendances` (koreksi absen) | `00008_fix_p2.sql` (+ UI admin menyusul) | M | ✅ |
| 9 | Satukan helper skor amalan | `src/lib/amalanScore.js` | S | ✅ |
| 10 | Tambah Laporan & Pengaturan di bottom nav super_admin | `BottomNav.vue` | S | ✅ |
| 11 | Filter "sesi hari ini" sesuai tanggal | `DashboardView.vue` | S | ✅ |
| 12 | Perbaiki filter status Laporan | `LaporanView.vue` | S | ✅ |
| 13 | Gabungkan query agregat (pagination tetap opsional) | Dashboard, RiwayatSesi, KelolaKelompok, AnggotaSaya | M | ✅ |

**Verifikasi cepat temuan #1 & #2** (sebelum menulis migrasi, pastikan di SQL Editor dengan role user/admin):
```sql
-- #1: login sebagai user biasa, cek
select * from sessions;                 -- harusnya kosong/ditolak untuk role user
-- #2: sebagai admin, coba
update profiles set group_id='<gid>' where id='<member_id>' and group_id is null;  -- harusnya ditolak RLS
```

---

## 4. Analisa Fitur Buka Sesi / Absensi Kelas (permintaan: multi-anggota + timestamp, terintegrasi Murabbi & Super Admin)

### 4.1 Kondisi saat ini (data model — SUDAH MENDUKUNG kelas multi-anggota)

| Aspek | Status | Bukti |
|---|---|---|
| Satu sesi = banyak anggota (kelas) | ✅ Didukung | `attendances` unique `(session_id, user_id)` — 1 baris/anggota/sesi, tanpa batas jumlah anggota |
| Timestamp per absen | ✅ Ada | `attendances.waktu_absen timestamptz default now()`; sesi: `dibuka_at`, `ditutup_at`, `tanggal` |
| Satu sesi terbuka per kelompok | ✅ Ada | partial unique index `one_open_session_per_group` |
| Absen via kamera+QR | ✅ Berfungsi | `ScanAbsenView` → RPC `get_profile_by_token` → insert (scoped P2 #6) |
| Realtime counter "X terabsen" | ✅ Berfungsi | `BerandaView` subscribe `attendances` INSERT (publikasi sudah ditambah P2 #7) |
| RLS insert/update/delete attendances | ✅ Scoped grup (P2 #6, #8) | `00008_fix_p2.sql` |

### 4.2 Gap yang dirasakan (kenapa terasa "hanya bisa 1 user")

1. **Halaman Scan = alur 1-per-1 tanpa jejak.** Setelah konfirmasi 1 anggota, kembali ke layar "Siap Scan" (harus tekan "Mulai Scan" lagi). Tidak ada daftar "sudah terabsen + jam berapa" di halaman scan — murabbi tidak tahu siapa yang sudah masuk. `ScanAbsenView.vue:107-110` (`handleScanAnother`), panel hasil menutup seluruh layar.
2. **Scan ulang anggota yang sama → cuma toast "Sudah diabsen sebelumnya"** (`ScanAbsenView.vue:95-97`), tanpa info status/waktu sebelumnya, dan tanpa opsi koreksi — padahal policy UPDATE/DELETE (#8) sudah siap di DB sejak P2, belum ada UI-nya.
3. **Beranda hanya menampilkan angka**, bukan daftar nama+jam (card "LIVE" `BerandaView.vue:285-291`).
4. **Super Admin tidak melihat progres live**: Dashboard menampilkan sesi aktif (nama kelompok, murabbi, jam buka — `DashboardView.vue:262-283`) tapi tanpa counter/daftar terabsen; tidak ada drill-down ke detail sesi. Laporan hanya untuk sesi tertutup (filter tanggal).
5. **Konsistensi RLS SELECT attendances**: policy `"user lihat riwayat sendiri"` (`00002:47-49`) = `auth.uid() = user_id or get_current_user_role() in ('admin','super_admin')` → **admin bisa SELECT kehadiran SEMUA kelompok** (tidak scoped, tidak konsisten dengan insert yang sudah scoped di #6). Bukan kebocoran kritis (data kehadiran), tapi melanggar prinsip scope yang sudah diterapkan.
6. **Riwayat & Laporan sudah lengkap**: `RiwayatSesiView` (summary per sesi), `AnggotaSayaView` (detail per anggota + timestamp, N+1 sudah digabung #13), `LaporanView` (per-sesi per-anggota + export Excel/PDF) — ✅ tidak perlu diubah.

### 4.3 Plan perbaikan (usulan, menunggu persetujuan)

| # | Aksi | Level | File | Status |
|---|---|---|---|---|
| 14 | **Alur scan kelas berkelanjutan**: setelah konfirmasi, kamera auto-restart (lewati layar "Siap Scan") + panel daftar terabsen sesi ini (nama, status, **timestamp**) update realtime | Murabbi | `ScanAbsenView.vue` | ✅ |
| 15 | **Scan ulang anggota sudah absen** → tampilkan status + waktu_absen-nya + tombol **Ubah Status** (memanfaatkan policy koreksi #8) / Hapus | Murabbi | `ScanAbsenView.vue` | ✅ |
| 16 | **Beranda**: daftar nama+jam "Baru saja terabsen" (atau panel terabsen) realtime | Murabbi | `BerandaView.vue` | ✅ |
| 17 | **Dashboard Super Admin**: counter terabsen live per sesi aktif + klik → **modal detail sesi** (daftar anggota + status + timestamp) | Super Admin | `DashboardView.vue` | ✅ |
| 18 | **Scope SELECT attendances admin ke kelompoknya** (super_admin tetap semua) — migrasi `00009_fix_p3.sql` | DB | migrations + verifikasi live | ✅ |

**Detail implementasi #14-18:**
- **#14** — `ScanAbsenView`: `handleConfirm` sukses/duplikat → langsung `handleStartCamera()` (kamera restart otomatis, tanpa kembali ke "Siap Scan"); panel "Terabsen (N)" di bawah tombol (realtime via channel `att-sesi-<id>`, filter `session_id=eq.<id>`, event `*`); daftar menampilkan nama, status, `waktu_absen` (HH:MM). Listener channel di-clean saat unmount/akhiri sesi.
- **#15** — `onScanResult` kini mengecek `attendances` (session_id + user_id, `.maybeSingle()`): jika sudah ada → banner kuning "Sudah diabsen HH:MM — status" + tombol **Ubah Status** (`update` — policy "admin koreksi kehadiran" #8) + **Hapus Catatan** (`delete` — policy "admin hapus kehadiran" #8); selesai koreksi → kamera restart.
- **#16** — `BerandaView`: `loadRecentAttendances()` (5 terakhir, nama + status + jam), dipanggil saat load & pada event realtime INSERT; card "Baru Terabsen" di bawah card LIVE.
- **#17** — `DashboardView`: `loadActiveCounts()` (1 query batched `.in` untuk semua sesi aktif → counter hadir/izin/alpa/total); subscribe realtime `attendances` event `*` → refresh counter + reload detail modal bila terbuka; tombol "Detail" per sesi → modal daftar anggota (avatar, nama, NIM, status, jam).
- **#18** — `00009_fix_p3.sql`: policy lama `"user lihat riwayat sendiri"` di-drop, diganti 2 policy: user → `auth.uid() = user_id`; admin → `"admin lihat kehadiran kelompoknya"` (super_admin semua, selainnya sesi `sessions.group_id = group_id` caller). **Terverifikasi live**: admin Ujang 6→1 baris (hanya sesi kelompoknya), super_admin tetap 6.

**Tidak dikerjakan (YAGNI):** absen manual massal via checkbox (user menegaskan absen berbasis kamera+QR); pagination; pencarian.

**Verifikasi rencana #18 (sudah dites live):** sebagai admin Ujang (grup Kelompok 9 Naga) → SELECT `attendances` = 6 baris (SEMUA grup) — terbukti tidak scoped; super_admin = 6 baris.
---

## 5. Polish Desain (Redesign Pass)

Diterapkan per skill redesign (audit → fix), tanpa migrasi stack:

| Area | Perubahan |
|---|---|
| **Font** | Sans system-ui → **Outfit** (400–700), dipasangkan dengan Playfair Display (serif, sudah ada) — `index.html` + `tailwind.config.js` |
| **Shadow** | Semua shadow (sm→xl) kini **tinted hijau brand** (rgba brand-700) — tanpa edit view, lewat override `boxShadow` di config; tambah `shadow-brand-glow` |
| **Aksesibilitas** | `:focus-visible` outline hijau global; skip-link "Lewati ke konten utama" di `AppLayout` (sr-only → focus) |
| **Tipografi** | `text-wrap: pretty` untuk p, `text-wrap: balance` untuk h1–h3, `font-variant-numeric: tabular-nums` di body |
| **Konsistensi warna** | Halaman auth (Login/Register/Pending) migrasi `emerald-*` → `brand-*`; shadow abu dihapus |
| **Meta** | `description` + `og:` tags di `index.html` |
| **404** | Halaman `NotFoundView.vue` (branded, tombol Kembali/Beranda) + route `/:pathMatch(.*)*` |
| **Konten** | Tanda seru dihapus dari toast "Sesi liqa dibuka" (ScanAbsen, Beranda) |

Verifikasi: `npm run build` lolos. Skips (YAGNI): cookie consent, footer legal links, animasi scroll-driven, glassmorphism — tidak relevan untuk app utility mobile-first.

---

## 6. Audit Bug & Test Keseluruhan (E2E live)

### 6.1 Temuan baru dari test E2E (live, 15 Agu 2026)

| # | Sev | Temuan | Bukti |
|---|---|---|---|
| A1 | **KRITIS** | **Beranda admin blank saat reload halaman** — race: `authStore.fetchSession()` mengisi `profile` async, `BerandaView.onMounted → loadData()` melihat `adminGroupId` masih null → `return` diam-diam tanpa pernah dipanggil ulang. Login fresh OK (profile sudah siap), reload → main kosong (`<!----><!---->`), hanya 2 request profil, tanpa console error | reload `/beranda` dengan sesi aktif → halaman kosong |
| A2 | SEDANG | Timer sesi (`elapsedSessionTime`) mati saat halaman dimuat dengan sesi sudah aktif (`startSessionTimer` hanya di `onMounted` + setelah `handleBukaSesi`) — terhubung ke A1 | kode `BerandaView.vue:199-203` |
| A3 | RENDAH | KelolaKelompok tampil "Belum ada Murabbi" untuk kelompok yang punya admin aktif (Kelompok Al-Furqan ↔ Admin Murabbi) — cek kemungkinan `groups.murabbi_id` kosong / hitungan role | halaman /dashboard/kelompok |
| A4 | RENDAH | Setelah simpan catatan tidak redirect (tetap di `/catatan/tambah`) — toast sukses tapi pengguna bisa double-save | /catatan/tambah |
| A5 | INFO | Halaman baca surat: 1x "Failed to fetch" (equran.id `ERR_CONNECTION_CLOSED`) — error state ada tapi tanpa tombol retry | /quran/1 |

### 6.2 Hasil audit kode (16 temuan, diurut prioritas) — verifikasi manual

**Sedang:**
- B1 `KalenderAmalanView.vue:101` → `goToDay()` push `?tanggal=` tapi `AmalanHarianView` tak pernah baca `route.query` — **TERKONFIRMASI LIVE**: klik 13 Agu di kalender → URL `/amalan?tanggal=2026-08-13` tapi halaman menampilkan "Sabtu, 15 Agustus 2026".
- B2 `AmalanHarianView.vue:151-152` — `watch(currentDate)` batalkan debounce tanpa simpan; `doSave()` in-flight tanggal lama menimpa `logData` tanggal baru → perubahan hilang diam-diam.
- B3 `useAmalan.js:8-14` — `getLog` tanpa cek `.error`; query gagal → form tampil "semua belum" → auto-save bisa menimpa data lama.
- B4 `ScanAbsenView.vue:80` — "Batal" saat scan hanya `pageStep='ready'`, kamera tak di-`stopScanner()` → "Mulai Scan" lagi throw "Already started" → macet sampai reload.
- B5 `KelolaKelompokView.vue:112-120` — hapus kelompok selalu gagal FK (`profiles.group_id`/`sessions.group_id` tanpa ON DELETE) + pesan error mentah.
- B6 `BerandaView.vue:199-203` — timer sesi (lihat A2).
- B7 `DashboardView.vue:40` — sesi aktif difilter `.eq('tanggal', today)` → sesi lintas hari hilang dari statistik & daftar.
- B8 Umum: `useSession.js`/`useAmalan.js`/`useAttendance.js`/`authStore.js` — destructure tanpa cek `.error`, `loading` tidak di-reset di `finally` → loading bisa macet permanen / data kosong diam-diam.

**Rendah:**
- B9 `ApprovalAnggotaView.vue:80-85` — Setujui/Tolak tanpa disabled → double-submit RPC.
- B10 `BerandaView.vue:226-236` — blank bila `adminGroupId` ada tapi `groupInfo` null (terkait A1).
- B11 `router/index.js:127-131` — query profil guard tanpa cek error → network gagal = user di-logout paksa.
- B12 `BerandaView.vue:210-214` — realtime INSERT memanggil 3x query (count + recent + loadData penuh).
- B13 `LaporanView.vue:61-64` — `.in('session_id', [])` tanpa guard → PostgREST 400 bila tak ada sesi (berbeda dgn DashboardView yang sudah diguard).
- B14 `DetailAmalanUserView.vue:78-79` — `logs.value.sort()` di dalam computed (mutasi sumber).
- B15 `RiwayatView.vue:27-29` — bila profil belum termuat → halaman kosong tanpa reset loading.
- B16 `QrSayaView.vue` — RPC `get_my_qr_token` gagal → kartu tanpa QR, tanpa pesan error.

### 6.3 Hasil test E2E (browser live, akun seed)

| Area | Hasil |
|---|---|
| Login/logout semua role + redirect by role | ✅ |
| **User**: QR Saya (canvas 300x300, statistik, download tombol), Al-Quran daftar (114) + baca surat (audio, bookmark, tafsir), Amalan Harian (form, skor /25), Catatan CRUD (buat → tampil → tags), Profil | ✅ (B1 gagal: kalender→tanggal) |
| **Admin**: Beranda (fix v-if berfungsi — stats/CTA/riwayat tampil), Buka Sesi (LIVE + timer 00:00:25), reload → **BLANK (A1)** | ⚠️ → ✅ (lihat 6.5) |
| **Super Admin**: Dashboard (stats, sesi aktif + modal Detail, kehadiran per kelompok, aktivitas murabbi, tren 7 hari — reload OK), Kelola Murabbi/Kelompok/Akun, Approval (empty state), Laporan (sesi + H/I/A + export), Pengaturan, Monitoring Amalan | ✅ |
| RLS attendances (migrasi 00009) | ✅ (sebelumnya: admin scoped) |
| **Tidak diuji** (lingkungan): scan kamera QR, export Excel/PDF file, realtime lintas perangkat | — |

### 6.4 Data uji — sudah dibersihkan
- Sesi "Uji E2E Buka Sesi" → ditutup (`is_open=false`), `open_sesi` kini 0.
- Catatan "Materi Uji Coba" (#test #e2e) → dihapus dari `notes`.

**Rekomendasi urutan fix:** A1/A2 (blank reload + timer) → B1 (kalender) → B4 (kamera) → B5 (hapus kelompok) → B2/B3 (data amalan) → B8 (pola composable) → sisanya minor.

### 6.5 Fix batch 1 — selesai & terverifikasi live
- **A1 (beranda blank saat reload)** ✅ — `BerandaView.vue`: panggilan `loadData()` di `onMounted` diganti `watch(adminGroupId, ..., { immediate: true })`; pola race yang sama juga difix di `ScanAbsenView.vue` (`watch(adminGroupId) → checkSession()`).
- **A2 (timer mati saat load dengan sesi aktif)** ✅ — timer dipindah ke `watch(sesiAktif, ...)` (start saat sesi aktif, stop saat null), bukan lagi hanya di `onMounted`/`handleBukaSesi`.
- **B4 (kamera stuck setelah Batal)** ✅ — `handleScanAnother` kini memanggil `stopScanner()` (scanner instance di-null-kan), "Mulai Scan" lagi tak lagi throw "Already started".
- Verifikasi live (deploy baru): login admin → beranda penuh → buka sesi → timer `00:00:09` → **reload → beranda tetap penuh + timer lanjut `00:00:31`** (bukan reset) → `/scan-absen` langsung mendeteksi sesi aktif → akhiri sesi → bersih. Tanpa console error. B4 tidak bisa diuji headless (butuh kamera fisik).

### 6.6 Fix batch 2 — selesai & terverifikasi live
- **B1 (kalender → tanggal diabaikan)** ✅ — `AmalanHarianView.vue`: `currentDate` kini diinisialisasi dari `route.query.tanggal` (validasi format `YYYY-MM-DD`, fallback hari ini) + `watch(() => route.query.tanggal)` agar back/forward browser sinkron. Verifikasi: `/amalan?tanggal=2026-08-13` → tampil "Kamis, 13 Agustus 2026" (sebelumnya selalu "Sabtu, 15 Agustus 2026").
- **B2 (auto-save menimpa data tanggal lain)** ✅ — `doSave` kini mengunci tanggal (`const tgl = tanggalStr.value`) & versi save (`saveSeq++`): saat pindah hari, save in-flight dibatalkan (tidak menimpa `logData`/`hasChanges` tanggal baru); `watch(currentDate)` ikut `saveSeq++`. Verifikasi: ubah Subuh 13 → langsung pindah ke 14 → data 14 (19/25) tetap utuh, save tersimpan ke 13.
- **B3 (getLog/getBulanan tanpa cek error)** ✅ — `useAmalan.js`: kedua fungsi kini cek `.error` (log + return null/[]) dan `loading` di-reset di `finally` (tak lagi stuck saat error).
- Data uji dibersihkan (Subuh 13 Agu dikembalikan ke "belum"). Console bersih (2 warning aksesibilitas pre-existing).

### 6.7 Fix batch 3 — selesai & terverifikasi live
- **B5 (hapus kelompok gagal FK)** ✅ — `KelolaKelompokView.vue`: sebelum delete, cek dependensi sesi (`count sessions`) → grup bersesi **ditolak** dengan pesan jelas (bukan error FK mentah), anggota di-lepas (`profiles.group_id → null`) dulu lalu grup dihapus. Verifikasi live: hapus "Kelompok 9 Naga" (7 sesi) → ditolak & grup utuh; "Grup Test B5" (0 sesi) → terhapus.
- **B7 (sesi lintas hari hilang)** ✅ — `DashboardView.vue:40`: hapus `.eq('tanggal', today)` dari query sesi aktif → sesi `is_open=true` lintas hari kini ikut dihitung. (Tidak bisa diuji headless tanpa sesi lintas hari; dashboard terkonfirmasi tetap berfungsi.)
- **B8 (pola composable)** ✅ — `useSession.js` (`getSesiAktif`, `getSesiSummary`) & `useAttendance.js` (`getRiwayatUser`): cek `.error` (log + return default), `loading` di-reset di `finally` (gabung pola `useAmalan.js` dari batch 2).
- **A3 ("Belum ada Murabbi")** ✅ — akar masalah: `groups.murabbi_id` kosong (data). Disinkronkan: Al-Furqan → Admin Murabbi, 9 Naga → Ujang Joestar (Zola sudah benar). Verifikasi live: semua kelompok tampil murabbi.
- **Minor** ✅ — B9 (Approval: `processingId` → disabled anti double-submit), B11 (router guard: error profil → log + lanjut, bukan logout paksa), B13 (Laporan: guard `.in('session_id', [])` → 400), B14 (DetailAmalanUser: `[...logs].sort()` tanpa mutasi), B15 (RiwayatUser: `watch(user.id)` → tak kosong selamanya), B16 (QrSaya: RPC error → pesan di UI), A5 (BacaSurat: tombol "Coba Lagi"). A4 sudah benar (redirect ada) — tidak perlu fix.
- Build lolos, deploy baru, tanpa regresi.

### 6.8 Dashboard — "Tren Kehadiran 7 Hari" jadi grafik
- `DashboardView.vue`: bar polos (deretan angka 0 + bar abu-abu) diganti **area/line chart SVG** (tanpa library baru — sesuai AGENTS.md): garis emerald + area gradient + titik per hari (tooltip jumlah absensi) + baseline + label hari. `weeklyTrend` kosong → garis di baseline, bukan error.
