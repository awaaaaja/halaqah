# STEPS.md — Rencana Eksekusi Bertahap

> **Proyek:** Aplikasi Absensi Liqa Berbasis QR Code
> **Fase mengacu pada roadmap di:** `plan-aplikasi-absensi-qr.md` (Section 9)
> **Acceptance criteria per modul:** `PRD.md` (Section 9)
> **Panduan coding & aturan:** `AGENTS.md`

---

## Siklus Kerja Setiap Step

Setiap step WAJIB mengikuti siklus 5 tahap di bawah ini. **JANGAN** melewati atau menggabungkan tahap.

```
[ ] THINKING  — Pahami konteks, identifikasi file yang disentuh, dependency, edge case
[ ] BUILD     — Implementasi kode sesuai hasil thinking
[ ] REVIEW    — Self-review: cek acceptance criteria (PRD.md), aturan (AGENTS.md), security hole
[ ] FIX       — Perbaiki masalah temuan review. Ulangi review-fix sampai bersih
[ ] LANJUT    — Tandai selesai hanya jika DoD terpenuhi. Baru lanjut ke step berikutnya
```

> **Keterangan:** Tanda `[ ]` akan dicentang menjadi `[x]` saat step benar-benar dieksekusi nanti.
> Dokumen ini adalah **kerangka rencana** — jangan eksekusi sekarang.

---

## Fase 1: Setup (1 step)

### Step 0 — Verifikasi Tool Desain UI UX Pro Max

Tool UI UX Pro Max sudah diinstall saat inisialisasi proyek (`npm install -g ui-ux-pro-max-cli && uipro init --ai opencode`). Verifikasi bahwa folder `.opencode/skills/ui-ux-pro-max/` ada dan skill dapat dimuat.

```
[ ] THINKING  — Pastikan folder .opencode/skills/ui-ux-pro-max/ ada. 
                Jika tidak ada, jalankan ulang instalasi. Skill ini akan dipakai terutama
                di Step 6 (Kartu QR Islamic).
[ ] BUILD     — Jalankan `uipro init --ai opencode` jika belum ada. Load skill dengan `skill("ui-ux-pro-max")`.
[ ] REVIEW    — Cek apakah folder skill ada dan berisi file yang diperlukan.
[ ] FIX       — Jika gagal, jalankan ulang instalasi dengan npm.
[ ] LANJUT    — Step 0 selesai → lanjut Step 1.
```

### Step 1 — Setup Project Vue + Vite + Tailwind + Supabase

**Fase roadmap:** 1. Setup
**Dependency:** Step 0

```
[ ] THINKING  — 
    • Buat project Vue 3 + Vite (vue-create atau npm create vue@latest)
    • Install dependencies: pinia, vue-router, @supabase/supabase-js, tailwindcss, postcss, autoprefixer
    • Install QR & scan: qrcode, html5-qrcode (atau vue-qrcode-reader)
    • Install export: xlsx, jspdf
    • Konfigurasi Tailwind: mobile-first (default breakpoint tanpa prefix untuk mobile, md:/lg: untuk scale-up)
    • Buat folder struktur sesuai AGENTS.md (src/components, src/views, src/stores, src/composables, src/router, src/lib, src/types, src/assets)
    • Buat lib/supabase.js dengan inisialisasi client dari .env
    • File yang disentuh: package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html, src/style.css, src/lib/supabase.js, .env.example
    • Edge case: Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.example (tidak di-commit)
```

```
[ ] BUILD     — Implementasi sesuai thinking. Jalankan npm install.
```

```
[ ] REVIEW    —
    • Cek package.json — semua dependency tercantum?
    • Cek tailwind.config.js — content path benar?
    • Cek src/lib/supabase.js — tidak ada hardcode credentials?
    • Coba `npm run dev` — tidak error?
```

```
[ ] FIX       — Perbaiki jika ada error.
```

```
[ ] LANJUT    — Step 1 selesai → lanjut Step 2.
```

---

## Fase 2: Auth (2 steps)

### Step 2 — Jalankan SQL Schema + RLS + Trigger di Supabase

**Fase roadmap:** 1. Setup
**Dependency:** Step 1

```
[ ] THINKING  —
    • Buka Supabase Dashboard → SQL Editor
    • Jalankan seluruh SQL dari plan Section 3: CREATE TABLE groups, profiles, sessions, attendances
    • Jalankan unique index one_open_session_per_group
    • Jalankan trigger handle_new_user()
    • Jalankan seluruh RLS policy dari plan Section 4
    • Jalankan RPC get_profile_by_token dari plan Section 4
    • Catat: unique constraint (session_id, user_id) di attendances
    • Catat: role check di profiles, status_akun check
    • Edge case: Urutan pembuatan tabel (groups dulu karena profiles references groups)
    • Tidak ada file proyek yang diubah — semua pure SQL via Supabase Dashboard/CLI
```

```
[ ] BUILD     — Eksekusi SQL di Supabase SQL Editor.
```

```
[ ] REVIEW    —
    • Cek di Supabase Table Editor — semua tabel terbuat dengan kolom sesuai?
    • Cek di Supabase Authentication → Triggers — trigger handle_new_user ada?
    • Cek di Supabase Database → Policies — semua RLS policy aktif?
    • Coba insert manual data dummy untuk test constraint?
    • Coba SELECT dari anon key tanpa auth → harus ditolak RLS?
    • Coba panggil get_profile_by_token dari role non-admin → harus error unauthorized?
```

```
[ ] FIX       — Perbaiki SQL jika ada typo/kekurangan. Ulangi review.
```

```
[ ] LANJUT    — Step 2 selesai → lanjut Step 3.
```

### Step 3 — Halaman Login & Register + Auto-Insert Profile

**Fase roadmap:** 2. Auth
**Dependency:** Step 1, Step 2

```
[ ] THINKING  —
    • Buat AuthLayout.vue (wrapper minimal untuk halaman auth)
    • Buat LoginView.vue — form email + password, tombol login, link ke register
    • Buat RegisterView.vue — form nama, NIM, prodi, kelas, angkatan, email, password, no HP
    • Buat composable useAuth.js — fungsi login(), register(), logout(), session listener
    • Buat authStore.js (Pinia) — state user, profil, role, status_akun
    • Routing: /login dan /register (public routes, tanpa guard)
    • Trigger handle_new_user() otomatis insert ke profiles saat signup — test setelah register
    • Setelah register redirect ke halaman "Akun Anda sedang menunggu approval"
    • File: src/views/auth/LoginView.vue, RegisterView.vue, src/components/layout/AuthLayout.vue, src/composables/useAuth.js, src/stores/authStore.js, src/router/index.js, src/router/routes.js
    • Edge case: User sudah login coba akses /login → redirect ke landing sesuai role
    • Edge case: User dengan status pending login → tampilkan halaman "Menunggu Approval"
```

```
[ ] BUILD     — Implementasi semua file.
```

```
[ ] REVIEW    —
    • Coba register — akun terbuat di auth.users? Profile terbuat dengan qr_token?
    • Coba login — session tersimpan? Store terisi?
    • Cek Supabase Auth — trigger jalan?
    • Cek console browser — tidak ada error?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 3 selesai → lanjut Step 4.
```

### Step 4 — Flow Approval User (Pending → Aktif)

**Fase roadmap:** 2. Auth
**Dependency:** Step 3

```
[ ] THINKING  —
    • Super Admin perlu halaman melihat daftar user dengan status_akun = 'pending'
    • Buat ApprovalAnggotaView.vue di folder super-admin/
    • List menampilkan: nama, NIM, email, tanggal daftar
    • Tombol "Setujui" → update profiles.status_akun = 'aktif'
    • Tombol "Tolak" → update profiles.status_akun = 'nonaktif'
    • RLS policy: hanya super_admin yang bisa update status_akun
    • Redirect user pending ke halaman "Akun Anda sedang menunggu approval" jika login
    • File: src/views/super-admin/ApprovalAnggotaView.vue, update authStore.js, update router guard
    • Edge case: Halaman approval hanya bisa diakses super_admin — route guard cek role
```

```
[ ] BUILD     — Implementasi approval flow.
```

```
[ ] REVIEW    —
    • Login sebagai super_admin — bisa lihat daftar pending?
    • Klik Setujui — status berubah jadi aktif?
    • Login sebagai user pending — tidak bisa akses halaman lain?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 4 selesai → lanjut Step 5.
```

---

## Fase 3: Layout & Routing (1 step)

### Step 5 — Layout Dasar Per Role + Bottom Tab Bar + Route Guard

**Fase roadmap:** 1. Setup (tapi dikerjakan setelah auth siap)
**Dependency:** Step 3, Step 4

```
[ ] THINKING  —
    • Buat BottomNav.vue — bottom tab bar dinamis berdasarkan role user (dari authStore)
      - Super Admin: Dashboard, Kelola Murabbi, Kelola Kelompok, Approval, Laporan, Pengaturan
      - Admin: Beranda, Scan Absen, Tambah Anggota, Anggota Saya, Riwayat Sesi
      - User: QR Saya, Riwayat, Profil
    • Buat AppLayout.vue — wrapper dengan BottomNav + <router-view>
    • Konfigurasi Vue Router:
      - Route guard: beforeEach cek session → ambil role → redirect ke landing sesuai role
      - Landing: user → /qr-saya, admin → /beranda, super_admin → /dashboard
      - Lazy loading per route untuk optimize bundle
    • Buat halaman placeholder (kosong dulu) untuk setiap view per role
    • Bottom nav untuk mobile (fixed bottom), di desktop bisa tetap bottom atau jadi sidebar (nanti polish)
    • File: BottomNav.vue, AppLayout.vue, semua file views/{super-admin,admin,user}/*.vue, router/index.js, router/routes.js
    • Edge case: User logout → redirect ke /login, bottom nav hilang
    • Edge case: Role tidak dikenal → redirect ke /login
```

```
[ ] BUILD     — Implementasi layout + routing + semua placeholder view.
```

```
[ ] REVIEW    —
    • Login sebagai user — bottom nav muncul dengan tab: QR Saya, Riwayat, Profil?
    • Login sebagai admin — bottom nav: Beranda, Scan, Tambah, Anggota, Riwayat?
    • Login sebagai super_admin — bottom nav: Dashboard, Murabbi, Kelompok, Approval, Laporan, Pengaturan?
    • Route guard — coba akses /dashboard sebagai user → redirect ke /qr-saya?
    • npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki jika ada error routing/nav.
```

```
[ ] LANJUT    — Step 5 selesai → lanjut Step 6.
```

---

## Fase 4: Kartu QR & Riwayat User (2 steps)

### Step 6 — Komponen Kartu QR Bernuansa Islamic (User)

**Fase roadmap:** 3. Kartu QR
**Dependency:** Step 5

```
[ ] THINKING  —
    ⚠️ Gunakan skill UI UX Pro Max untuk panduan desain (palet, tipografi, spacing).
    • Buat komponen QRCard.vue di components/qr/ — menampilkan QR + frame Islamic
    • Buat QRFrame.vue — ornamen geometris Islamic di sekitar QR (border, sudut)
    • Buat QrSayaView.vue di views/user/ — halaman utama user
    • Generate QR dari qr_token menggunakan library `qrcode` (toCanvas atau toDataURL)
    • Desain kartu QR sesuai plan Section 7.3:
      - Background krem (#FDF6E3)
      - Border/ornamen hijau tua (#0F5132) + emas (#D4AF37)
      - QR hitam-putih murni, quiet zone terjaga
      - Nama & identitas pakai font serif (Playfair Display)
      - Data teknis (NIM, kelompok) pakai sans-serif
      - Opsional: kaligrafi tipis di header, badge kelompok di footer
    • Tombol download kartu QR sebagai PNG (gunakan html2canvas atau canvas.toBlob)
    • Import font Playfair Display di index.html atau style.css
    • File: src/components/qr/QRCard.vue, QRFrame.vue, src/views/user/QrSayaView.vue, src/style.css, index.html
    • Edge case: QR token tidak ada/null → jangan render, tampilkan error state
    • Edge case: User belum punya group_id → tetap tampilkan QR, group = "-"
    • Edge case: Ukuran QR di mobile — harus cukup besar untuk discan (min 200x200px)
```

```
[ ] BUILD     — Implementasi kartu QR dengan UI UX Pro Max.
```

```
[ ] REVIEW    —
    • Tampilan kartu QR — apakah sesuai spesifikasi Islamic di PRD?
    • QR bisa di-scan? Coba scan dengan HP aplikasi QR reader?
    • Tombol download — hasil unduhan sesuai tampilan?
    • Cek npm run build — tidak error?
    • Cek console browser — tidak ada warning/error?
```

```
[ ] FIX       — Perbaiki desain/error jika ada.
```

```
[ ] LANJUT    — Step 6 selesai → lanjut Step 7.
```

### Step 7 — Halaman Riwayat Kehadiran (User)

**Fase roadmap:** 3. Kartu QR
**Dependency:** Step 5, Step 6

```
[ ] THINKING  —
    • Buat RiwayatView.vue di views/user/
    • Query attendances WHERE user_id = auth.uid() JOIN sessions untuk dapat tanggal, judul_materi
    • Tampilkan list per sesi: tanggal, judul materi, status (hadir/izin/alpa)
    • Data tersimpan permanen per akun — tidak bisa dihapus oleh user
    • Gunakan composable useAttendance.js untuk logic query
    • Tampilkan badge/icon per status: hadir (hijau), izin (kuning), alpa (merah)
    • Tambahkan ringkasan: total sesi, total hadir, persentase kehadiran
    • File: src/views/user/RiwayatView.vue, src/composables/useAttendance.js, update router/routes.js
    • Edge case: Belum pernah absen → tampilkan "Belum ada catatan kehadiran"
    • Edge case: Banyak data → infinite scroll atau pagination (10-20 per page)
```

```
[ ] BUILD     — Implementasi riwayat kehadiran user.
```

```
[ ] REVIEW    —
    • Login sebagai user — lihat riwayat, apakah data sesuai dengan attendances?
    • Jika belum ada absen — tampilkan empty state?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki jika ada error.
```

```
[ ] LANJUT    — Step 7 selesai → lanjut Step 8.
```

---

## Fase 5: Scan Absen & Sesi (3 steps)

### Step 8 — RPC get_profile_by_token + Halaman Scan Absen (Admin)

**Fase roadmap:** 4. Scan Absen
**Dependency:** Step 2 (RPC), Step 5

```
[ ] THINKING  —
    • RPC get_profile_by_token sudah dibuat di Step 2 — verifikasi berfungsi
    • Buat ScanAbsenView.vue di views/admin/
    • Integrasi kamera menggunakan html5-qrcode (atau vue-qrcode-reader)
    • Flow scan:
      1. Kamera aktif (permit request izin kamera)
      2. Scan QR → ekstrak qr_token
      3. Panggil supabase.rpc('get_profile_by_token', { token }) — bukan query langsung!
      4. Tampilkan data anggota (nama, NIM, prodi, kelas, nama_kelompok)
      5. Tombol "Konfirmasi Hadir" (default), opsi dropdown "Izin" / "Alpa"
    • Cek apakah sesi terbuka untuk grup admin — jika tidak, tampilkan pesan "Buka sesi terlebih dahulu"
    • Buat composable useQrScanner.js — manajemen kamera (start/stop, error handling)
    • File: src/views/admin/ScanAbsenView.vue, src/composables/useQrScanner.js, update src/composables/useAttendance.js
    • Edge case: Izin kamera ditolak → tampilkan petunjuk cara mengaktifkan
    • Edge case: QR tidak valid (token tidak ditemukan) → tampilkan "QR tidak dikenal"
    • Edge case: Scan QR dobel di sesi sama → tangkap error unique constraint, tampilkan "Sudah diabsen"
    • Edge case: Tidak ada sesi terbuka → kamera tidak aktif, tombol scan disabled
```

```
[ ] BUILD     — Implementasi scan absen.
```

```
[ ] REVIEW    —
    • Buka halaman scan tanpa sesi terbuka → muncul pesan?
    • Buka halaman scan dengan sesi terbuka → kamera aktif?
    • Scan QR valid — data anggota tampil?
    • Klik Konfirmasi Hadir — attendance terinsert? Notifikasi sukses?
    • Scan QR tidak valid — error handling?
    • Scan QR dobel — tampilkan "Sudah diabsen"?
    • Cek SUPABASE — panggilan RPC, bukan SELECT langsung?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 8 selesai → lanjut Step 9.
```

### Step 9 — Fitur Buka Sesi & Akhiri Sesi (Admin)

**Fase roadmap:** 4. Scan Absen
**Dependency:** Step 5, Step 8

```
[ ] THINKING  —
    • Update BerandaView.vue di views/admin/:
      - Tampilkan status sesi hari ini: kosong / sedang berjalan / ditutup
      - Tombol "Buka Sesi" besar (mobile-friendly)
      - Jika sesi berjalan: tombol "Scan Absen" (navigasi ke /scan-absen) dan "Akhiri Sesi"
      - Jika ditutup: tampilkan ringkasan hasil absen sesi tsb (hadir/izin/alpa)
    • Buat composable useSession.js — fungsi:
      - bukaSesi(group_id, judul_materi) → insert sessions
      - getSesiAktif(group_id) → cek apakah ada is_open = true
      - akhiriSesi(session_id) → update is_open=false, ditutup_at=now()
      - getRiwayatSesi(group_id) → list sesi yang sudah ditutup
    • Unique index mencegah buka sesi ganda — handle error constraint
    • File: src/views/admin/BerandaView.vue, src/composables/useSession.js, update src/router/routes.js
    • Edge case: Coba buka sesi saat sudah ada sesi terbuka → tangkap error, tampilkan pesan
    • Edge case: Akhiri sesi yang sudah ditutup → error handling
    • Edge case: Sesi dibuka hari H, lintas tanggal → tetap pakai current_date
```

```
[ ] BUILD     — Implementasi buka/akhiri sesi.
```

```
[ ] REVIEW    —
    • Klik Buka Sesi — terinsert di sessions? is_open=true?
    • Coba Buka Sesi lagi — error unique constraint muncul?
    • Tombol Scan Absen — navigasi ke /scan-absen?
    • Klik Akhiri Sesi — is_open=false, ditutup_at terisi? Ringkasan tampil?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 9 selesai → lanjut Step 10.
```

### Step 10 — Fitur Tambah Anggota (Admin)

**Fase roadmap:** 5. Manajemen
**Dependency:** Step 5

```
[ ] THINKING  —
    • Buat TambahAnggotaView.vue di views/admin/
    • Query profiles WHERE group_id IS NULL AND status_akun = 'aktif'
    • Tampilkan daftar: nama, NIM, prodi, kelas, angkatan
    • Search/filter berdasarkan nama atau NIM
    • Tombol "Tambah ke Kelompok Saya" per item → update profiles.group_id = admin.group_id
    • RLS policy "admin assign anggota tanpa grup" mengizinkan update hanya jika group_id IS NULL
    • Tampilkan notifikasi sukses setelah assign
    • Hanya anggota aktif yang muncul (status_akun = 'aktif')
    • File: src/views/admin/TambahAnggotaView.vue, update src/composables/useSupabase.js atau buat composable useAnggota.js
    • Edge case: Semua anggota sudah punya grup → tampilkan "Semua anggota sudah memiliki kelompok"
    • Edge case: Admin tidak punya grup → jangan tampilkan error, tapi tombol disable dengan tooltip "Anda belum ditetapkan ke kelompok"
    • Edge case: Search tidak menemukan → tampilkan "Tidak ditemukan"
```

```
[ ] BUILD     — Implementasi tambah anggota.
```

```
[ ] REVIEW    —
    • Daftar anggota tanpa grup muncul?
    • Search bekerja?
    • Klik Tambah — group_id berubah?
    • Coba tambah anggota yang sudah punya grup — tidak boleh muncul di daftar?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 10 selesai → lanjut Step 11.
```

### Step 11 — Halaman Anggota Saya & Riwayat Sesi (Admin)

**Fase roadmap:** 5. Manajemen
**Dependency:** Step 5, Step 10

```
[ ] THINKING  —
    • Buat AnggotaSayaView.vue:
      - Daftar anggota di kelompok admin (profiles WHERE group_id = admin.group_id)
      - Per anggota: nama, NIM, prodi, kelas
      - Klik anggota → lihat riwayat kehadiran anggota tersebut (attendances by user_id)
      - Ekspandable/collapsible card per anggota
    • Buat RiwayatSesiView.vue:
      - Daftar sessions WHERE group_id = admin.group_id ORDER BY created_at DESC
      - Per sesi: tanggal, judul materi, status (ditutup/berjalan), ringkasan hadir/izin/alpa
      - Query count attendances per status untuk ringkasan
    • File: src/views/admin/AnggotaSayaView.vue, src/views/admin/RiwayatSesiView.vue, update router
    • Edge case: Admin belum punya anggota → "Belum ada anggota"
    • Edge case: Admin belum punya riwayat sesi → "Belum pernah membuka sesi"
```

```
[ ] BUILD     — Implementasi anggota saya & riwayat sesi.
```

```
[ ] REVIEW    —
    • Anggota Saya — menampilkan anggota kelompok dengan benar?
    • Klik anggota — riwayat kehadiran tampil?
    • Riwayat Sesi — list sesi & ringkasan benar?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 11 selesai → lanjut Step 12.
```

---

## Fase 6: Super Admin (3 steps)

### Step 12 — Dashboard Monitoring (Super Admin)

**Fase roadmap:** 6. Laporan
**Dependency:** Step 5

```
[ ] THINKING  —
    • Buat DashboardView.vue di views/super-admin/ — laman utama Super Admin
    • Komponen dashboard:
      - Kartu statistik: total kelompok, total admin, total anggota aktif
      - Ringkasan sesi hari ini: jumlah grup yang buka sesi, total kehadiran
      - Tingkat kehadiran per kelompok (progress bar atau mini chart)
      - Aktivitas admin minggu ini: siapa yang sudah/belum buka sesi
      - Tren kehadiran (line chart sederhana — bisa pakai canvas manual atau chart library ringan)
    • Query agregat dari sessions, attendances, profiles, groups
    • Data diperbarui realtime via Supabase Realtime subscription (Step 15 nanti)
    • File: src/views/super-admin/DashboardView.vue, update src/stores/appStore.js jika perlu
    • Edge case: Belum ada data — tampilkan placeholder/grafik kosong
    • Edge case: Banyak kelompok — scroll vertikal, grid responsive
```

```
[ ] BUILD     — Implementasi dashboard monitoring.
```

```
[ ] REVIEW    —
    • Login super_admin — dashboard menampilkan data?
    • Ringkasan statistik sesuai dengan data di database?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 12 selesai → lanjut Step 13.
```

### Step 13 — Tab-Tab Super Admin (Kelola Murabbi, Kelola Kelompok, Approval, Pengaturan)

**Fase roadmap:** 6. Laporan
**Dependency:** Step 5, Step 12

```
[ ] THINKING  —
    • Buat KelolaMurabbiView.vue:
      - CRUD akun admin: daftar admin, tambah (dari user yang ada atau buat baru), edit assign kelompok, hapus
      - Pilih user dari daftar yang role-nya akan diubah menjadi admin
      - Assign admin ke kelompok (dropdown group list)
    • Buat KelolaKelompokView.vue:
      - CRUD kelompok: daftar kelompok, tambah (nama, deskripsi, pilih murabbi), edit, hapus
      - Per kelompok: tampilkan jumlah anggota
    • ApprovalAnggotaView.vue — sudah dibuat di Step 4, review & perbaiki jika perlu
    • Buat PengaturanView.vue:
      - Profil super admin (edit terbatas)
      - Opsional: log aktivitas sistem
    • File: semua file di src/views/super-admin/, update router
    • Edge case: Hapus admin yang sedang aktif sebagai murabbi suatu kelompok — perlu konfirmasi
    • Edge case: Hapus kelompok yang memiliki anggota — perlu reassign atau blokir
```

```
[ ] BUILD     — Implementasi semua tab super admin.
```

```
[ ] REVIEW    —
    • Kelola Murabbi — bisa tambah admin? Assign ke kelompok?
    • Kelola Kelompok — CRUD berfungsi?
    • Approval — sama seperti Step 4, konsisten?
    • Pengaturan — menampilkan profil?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 13 selesai → lanjut Step 14.
```

### Step 14 — Tab Laporan (Super Admin) — Filter + Export

**Fase roadmap:** 6. Laporan
**Dependency:** Step 12

```
[ ] THINKING  —
    • Buat LaporanView.vue di views/super-admin/
    • Filter:
      - Dropdown kelompok (semua atau pilih salah satu)
      - Rentang tanggal (date range picker)
      - Dropdown angkatan
    • Tabel rekap: per anggota, tampilkan total hadir, izin, alpa
    • Tabel detail: per sesi dalam rentang, per anggota statusnya
    • Tombol "Export Excel" — gunakan SheetJS (xlsx):
      - Buat workbook, worksheet dari data, download sebagai .xlsx
    • Tombol "Export PDF" — gunakan jsPDF:
      - Buat tabel di PDF, download
    • File: src/views/super-admin/LaporanView.vue
    • Edge case: Tidak ada data dalam filter → "Tidak ada data"
    • Edge case: Export banyak data — pertimbangkan pagination atau loading state
```

```
[ ] BUILD     — Implementasi laporan + export.
```

```
[ ] REVIEW    —
    • Filter bekerja — data sesuai filter?
    • Export Excel — file terdownload? Isi benar?
    • Export PDF — file terdownload? Isi benar?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 14 selesai → lanjut Step 15.
```

---

## Fase 7: Polish & Realtime (2 steps)

### Step 15 — Realtime Update Saat Scan Absen

**Fase roadmap:** 7. Polish
**Dependency:** Step 8, Step 12

```
[ ] THINKING  —
    • Supabase Realtime: subscribe ke channel `attendances:insert` untuk update dashboard Super Admin
    • Saat admin scan absen → insert attendances → dashboard Super Admin otomatis update (tanpa refresh)
    • Implementasi di DashboardView.vue:
      - supabase.channel('attendance-updates').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendances' }, handler)
      - Update statistik dashboard secara realtime
    • Juga subscribe ke sessions:update untuk status sesi (buka/akhiri)
    • File: update src/views/super-admin/DashboardView.vue, update src/composables/useAttendance.js
    • Edge case: Koneksi realtime putus — fallback ke polling periodik atau manual refresh
    • Edge case: Banyak update berbarengan — debounce handler
```

```
[ ] BUILD     — Implementasi realtime subscription.
```

```
[ ] REVIEW    —
    • Buka dashboard super admin + admin scan absen — dashboard update realtime?
    • Cek konsol browser — subscription aktif?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error jika ada.
```

```
[ ] LANJUT    — Step 15 selesai → lanjut Step 16.
```

### Step 16 — Polish UI Responsif + Notifikasi

**Fase roadmap:** 7. Polish
**Dependency:** Semua step sebelumnya

```
[ ] THINKING  —
    • Audit semua halaman:
      - Cek tampilan di 320px (small mobile), 375px (iPhone), 414px (Android), 768px (tablet), 1024px+ (desktop)
      - Bottom nav — berfungsi di semua ukuran?
      - Kartu QR — proporsional di mobile? Download tetap jalan?
      - Kamera scan — fullscreen di mobile?
    • Tambahkan notifikasi in-app (toast) menggunakan Pinia store appStore:
      - Sukses absen, error, warning, info
      - Bisa gunakan composable useNotification atau library ringan
    • Konsistensi spacing, font, warna menggunakan design token dari UI UX Pro Max
    • Loading state di setiap halaman (skeleton atau spinner)
    • Error state di setiap halaman
    • Empty state di setiap halaman
    • File: update banyak file — audit per halaman
    • Edge case: Orientasi landscape di mobile — beberapa halaman perlu diadjust
```

```
[ ] BUILD     — Implementasi polish UI + notifikasi.
```

```
[ ] REVIEW    —
    • Cek semua halaman di Chrome DevTools mobile viewport
    • Cek di tablet dan desktop viewport
    • Notifikasi muncul saat sukses/error?
    • Loading state muncul saat data belum ter-load?
    • Cek npm run build — tidak error?
```

```
[ ] FIX       — Perbaiki error/kekurangan UI.
```

```
[ ] LANJUT    — Step 16 selesai → lanjut Step 17.
```

---

## Fase 8: Deployment (1 step)

### Step 17 — Deployment

**Fase roadmap:** 8. Deploy
**Dependency:** Semua step sebelumnya

```
[ ] THINKING  —
    • Frontend: deploy ke Vercel atau Netlify
      - Hubungkan repo GitHub
      - Set environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
      - Build command: npm run build
      - Output directory: dist/
    • Backend: sudah running di Supabase Cloud
      - Verifikasi RLS aktif
      - Verifikasi trigger handle_new_user berjalan
      - Verifikasi RPC get_profile_by_token bisa dipanggil
    • Domain: (opsional) kustom domain
    • File: Tidak ada perubahan kode — hanya konfigurasi deployment
    • Checklist pra-deploy:
      - ✅ npm run build tanpa error
      - ✅ Semua .env variable terisi di production
      - ✅ RLS aktif di semua tabel
      - ✅ Tidak ada console.log yang mengekspos data sensitif
      - ✅ Tidak ada hardcode credentials
      - ✅ CORS di Supabase sudah dikonfigurasi untuk domain frontend
```

```
[ ] BUILD     — Deploy frontend ke Vercel/Netlify.
```

```
[ ] REVIEW    —
    • Buka URL production — aplikasi berfungsi?
    • Coba register → approval → login → kartu QR → scan absen → laporan
    • Cek RLS — coba akses dari role tidak berhak
    • Cek console browser — tidak ada error?
```

```
[ ] FIX       — Perbaiki jika ada issue production.
```

```
[ ] LANJUT    — ✅ PROYEK SELESAI. Semua step terpenuhi.
```

---

## Ringkasan Step vs Fase

| Step | Fase | Deskripsi | Dep |
|---|---|---|---|
| 0 | — | Verifikasi UI UX Pro Max | — |
| 1 | 1. Setup | Init Vue + Vite + Tailwind + Supabase | 0 |
| 2 | 1. Setup | SQL Schema + RLS + Trigger + RPC | 1 |
| 3 | 2. Auth | Login & Register + auto-profile | 1,2 |
| 4 | 2. Auth | Approval flow (pending → aktif) | 3 |
| 5 | 1. Setup | Layout + Bottom Nav + Route Guard | 3,4 |
| 6 | 3. Kartu QR | Kartu QR Islamic (User) | 5 |
| 7 | 3. Kartu QR | Riwayat Kehadiran (User) | 5,6 |
| 8 | 4. Scan Absen | RPC + Halaman Scan (Admin) | 2,5 |
| 9 | 4. Scan Absen | Buka & Akhiri Sesi (Admin) | 5,8 |
| 10 | 5. Manajemen | Tambah Anggota (Admin) | 5 |
| 11 | 5. Manajemen | Anggota Saya & Riwayat Sesi (Admin) | 5,10 |
| 12 | 6. Laporan | Dashboard Monitoring (Super Admin) | 5 |
| 13 | 6. Laporan | Tab-tab Super Admin | 5,12 |
| 14 | 6. Laporan | Laporan + Export Excel/PDF | 12 |
| 15 | 7. Polish | Realtime Update | 8,12 |
| 16 | 7. Polish | Polish UI + Notifikasi | Semua |
| 17 | 8. Deploy | Deployment | Semua |

---

> **Dokumen ini adalah kerangka rencana.** Saat eksekusi nanti, setiap `[ ]` akan dicentang menjadi `[x]` dan diisi detail implementasi aktualnya.
