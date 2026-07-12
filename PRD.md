# Product Requirements Document — Aplikasi Absensi Liqa Berbasis QR Code

> **Dokumen ini merupakan turunan dari** `plan-aplikasi-absensi-qr.md` (source of truth).
> Semua keputusan teknis (schema, RLS, role, routing) merujuk ke plan tersebut.

---

## 1. Latar Belakang & Tujuan Produk

Sistem absensi manual di lingkungan liqa (halaqah) selama ini merepotkan — Murabbi harus mencentang daftar nama kertas, data mudah hilang, dan Super Admin kesulitan memonitor kehadiran lintas kelompok secara realtime. Banyak anggota juga tidak memiliki identitas digital yang bisa dengan cepat dipindai saat sesi berlangsung.

**Tujuan produk:** Membangun aplikasi absensi berbasis QR Code dengan Vue 3 + Supabase yang:
- Memberi setiap anggota kartu QR personal sebagai identitas digital
- Memungkinkan Murabbi membuka sesi dan mencatat kehadiran cukup dengan scan QR
- Memberi Super Admin dashboard monitoring realtime lintas kelompok dan export laporan
- Mengedepankan prinsip **Mobile First** karena mayoritas akses dilakukan dari HP

---

## 2. Target Pengguna & Role

| Role | Deskripsi | Hak Akses Inti |
|---|---|---|
| **Super Admin** | Pengelola utama sistem — biasanya koordinator liqa tingkat institusi | CRUD admin/murabbi, CRUD kelompok, approve anggota, lihat & export laporan gabungan, kelola pengaturan sistem |
| **Admin (Murabbi)** | Pembimbing kelompok liqa — biasanya seorang pengajar/dosen senior | Buka/akhiri sesi liqa, scan QR anggota untuk absen, tambah anggota ke kelompoknya, lihat rekap kelompok & riwayat sesi |
| **User (Anggota)** | Peserta liqa — mahasiswa/santri | Registrasi, lihat & download kartu QR sendiri, lihat riwayat kehadiran permanen per sesi |

### Matrix Permission Detail

| Fitur | Super Admin | Admin | User | Publik |
|---|---|---|---|---|
| Login/Register | — | — | — | ✅ |
| Lihat profil sendiri | ✅ | ✅ | ✅ | — |
| Edit profil sendiri (terbatas) | ✅ | ✅ | ✅ (non-akademik) | — |
| Lihat semua profil | ✅ | ✅ (group sendiri) | ❌ | — |
| Approve akun pending | ✅ | ❌ | ❌ | — |
| CRUD kelompok | ✅ | ❌ | ❌ | — |
| CRUD admin/murabbi | ✅ | ❌ | ❌ | — |
| Buka/akhiri sesi | ✅ (semua grup) | ✅ (grup sendiri) | ❌ | — |
| Scan QR untuk absen | ✅ | ✅ | ❌ | — |
| Tambah anggota ke grup | ❌ | ✅ (anggota tanpa grup) | ❌ | — |
| Lihat kartu QR sendiri | ❌ | ❌ | ✅ | — |
| Lihat riwayat kehadiran sendiri | ✅ (semua) | ✅ (group sendiri) | ✅ (diri sendiri) | — |
| Dashboard monitoring | ✅ (lintas grup) | ❌ | ❌ | — |
| Laporan & export | ✅ | ❌ | ❌ | — |
| Pengaturan sistem | ✅ | ❌ | ❌ | — |

---

## 3. Prinsip UI/UX

### 3.1 Mobile First, Scalable ke Desktop

Satu codebase responsif dengan **breakpoint mobile sebagai default**. Semua layout, komponen, dan interaksi dirancang utama untuk layar HP (320px–480px), lalu di-scale up ke tablet/desktop via utility `md:` dan `lg:` Tailwind. Tidak ada versi terpisah mobile vs desktop.

### 3.2 Navigasi & Laman Berbeda per Role

Bukan satu dashboard generik. Setiap role memiliki **set halaman dan bottom tab bar sendiri** yang diimplementasikan sebagai komponen Vue Router terpisah:

**Super Admin — Bottom Tab:**
1. **Dashboard/Monitoring** — laman utama: ringkasan progress liqa lintas kelompok (grafik sesi berjalan, tingkat kehadiran per grup, aktivitas admin minggu ini, tren kehadiran)
2. **Kelola Murabbi** — CRUD akun admin, assign ke kelompok
3. **Kelola Kelompok** — CRUD kelompok liqa
4. **Approval Anggota** — daftar akun `pending` → approve/tolak
5. **Laporan** — filter kelompok/tanggal/angkatan + export Excel/PDF
6. **Pengaturan** — profil super admin & pengaturan sistem

**Admin (Murabbi) — Bottom Tab:**
1. **Beranda** — status sesi hari ini (kosong/berjalan/ditutup), ringkasan kelompok
2. **Scan Absen** — kamera scan QR (hanya aktif jika sesi terbuka)
3. **Tambah Anggota** — daftar anggota `group_id IS NULL` → assign ke grup
4. **Anggota Saya** — daftar anggota kelompok + riwayat masing-masing
5. **Riwayat Sesi** — log sesi yang sudah ditutup + rekap kehadiran

**User (Anggota) — Bottom Tab:**
1. **Kartu Saya (QR)** — QR code besar + identitas (landing page setelah login)
2. **Catatan Kehadiran** — riwayat per sesi liqa (permanen per akun)
3. **Profil Saya** — lihat/edit data diri terbatas

### 3.3 Tema Visual Islamic — Spesifikasi Kartu QR

Kartu QR di laman "Kartu Saya" (User) merupakan elemen visual utama aplikasi:

| Aspek | Spesifikasi |
|---|---|
| **Palet dasar** | Hijau tua/zamrud (`#0F5132`–`#14532D`) atau navy |
| **Aksen** | Emas/gold (`#D4AF37`) untuk border & detail |
| **Latar kartu** | Krem/off-white (`#FDF6E3`) — kontras tinggi dengan QR |
| **QR code** | Hitam-putih murni di dalam frame — **jangan** diberi warna/gradasi agar mudah discan |
| **Bingkai/ornamen** | Motif geometris Islamic (girih/tessellation) atau arabesque di **luar** area QR — tidak menimpa modul QR |
| **Tipografi nama** | Font serif/elegant (Playfair Display atau serupa) untuk nama & identitas |
| **Tipografi data** | Sans-serif untuk data teknis (NIM, kelas, kelompok) agar terbaca di layar kecil |
| **Quiet zone** | Area margin putih standar QR **wajib** dijaga — tidak boleh ditimpa ornamen apa pun |
| **Aksesibilitas** | Kontras wajib WCAG AA — apa pun ornamennya, QR harus tetap terbaca kamera |
| **Elemen opsional** | Kaligrafi kecil/ornamen tipis di header, badge nama kelompok di footer |

---

## 4. User Stories

### Super Admin
1. **Sebagai Super Admin**, saya ingin melihat dashboard monitoring yang menampilkan progress seluruh kelompok liqa, agar saya bisa mengetahui aktivitas admin dan tingkat kehadiran anggota secara realtime lintas kelompok.
2. **Sebagai Super Admin**, saya ingin mengelola akun Murabbi (CRUD) dan menetapkan kelompok binaannya, agar struktur organisasi liqa tertata rapi.
3. **Sebagai Super Admin**, saya ingin menyetujui atau menolak pendaftaran anggota baru yang masih berstatus `pending`, agar hanya anggota yang valid yang bisa menggunakan sistem.
4. **Sebagai Super Admin**, saya ingin membuat, mengedit, dan menghapus kelompok liqa, agar struktur kelompok bisa disesuaikan dengan kebutuhan.
5. **Sebagai Super Admin**, saya ingin melihat laporan kehadiran yang bisa difilter berdasarkan kelompok, tanggal, atau angkatan dan diexport ke Excel/PDF, agar saya bisa menyusun laporan evaluasi.
6. **Sebagai Super Admin**, saya ingin melihat siapa saja admin yang sudah/belum membuka sesi dalam seminggu terakhir, agar saya bisa menindaklanjuti kelompok yang tidak aktif.

### Admin (Murabbi)
1. **Sebagai Admin**, saya ingin membuka sesi liqa dengan satu tombol, agar saya bisa memulai pencatatan kehadiran di pertemuan hari ini.
2. **Sebagai Admin**, saya ingin memindai QR code anggota menggunakan kamera HP, agar pencatatan kehadiran cepat tanpa perlu menyebut nama satu per satu.
3. **Sebagai Admin**, saya ingin menambahkan anggota yang belum memiliki grup ke kelompok saya, agar saya bisa mengelola keanggotaan kelompok secara mandiri.
4. **Sebagai Admin**, saya ingin mengakhiri sesi liqa dan otomatis melihat ringkasan kehadiran sesi tersebut, agar saya tahu siapa saja yang hadir, izin, atau alpa.
5. **Sebagai Admin**, saya ingin melihat daftar anggota kelompok saya beserta riwayat kehadiran masing-masing, agar saya bisa memantau partisipasi anggota.
6. **Sebagai Admin**, saya ingin melihat riwayat sesi yang sudah pernah saya buka beserta rekapnya, agar saya bisa mengevaluasi konsistensi pertemuan.

### User (Anggota)
1. **Sebagai Anggota**, saya ingin mendaftar akun dengan mengisi data diri (nama, NIM, prodi, kelas, angkatan), agar saya terdaftar dalam sistem absensi liqa.
2. **Sebagai Anggota**, saya ingin melihat kartu QR personal saya yang bernuansa Islamic, agar saya bisa menunjukkannya ke Murabbi saat scan absen.
3. **Sebagai Anggota**, saya ingin mengunduh/menyimpan kartu QR saya, agar saya bisa mencetaknya atau menyimpannya di galeri HP.
4. **Sebagai Anggota**, saya ingin melihat riwayat kehadiran saya yang tersimpan permanen per sesi, agar saya bisa mengecek rekam jejak kehadiran saya selama mengikuti liqa.
5. **Sebagai Anggota**, saya ingin melihat dan mengedit data profil saya (terbatas pada no HP dan informasi non-akademik), agar data saya tetap update.

---

## 5. Functional Requirements

### 5.1 Modul Auth
- FR-01: Pengguna dapat mendaftar dengan email, password, nama, NIM, prodi, kelas, angkatan, no HP
- FR-02: Sistem otomatis membuat profile dengan `qr_token` unik (16 byte random hex) saat registrasi
- FR-03: Status akun baru = `pending` — tidak bisa login/login terbatas sampai di-approve
- FR-04: Pengguna dapat login dengan email + password via Supabase Auth
- FR-05: Super Admin dapat melihat daftar akun pending dan mengubah statusnya menjadi `aktif`
- FR-06: Super Admin dapat menonaktifkan akun (status `nonaktif`)
- FR-07: Trigger database `handle_new_user()` mengisi `profiles` otomatis saat `auth.users` dibuat

### 5.2 Modul Kartu QR
- FR-08: User dapat melihat kartu QR personal di halaman `/qr-saya`
- FR-09: QR code berisi `qr_token` string, ditampilkan sebagai QR hitam-putih dalam frame bernuansa Islamic
- FR-10: Kartu QR menampilkan nama, NIM, dan nama kelompok di bawah QR
- FR-11: User dapat mengunduh kartu QR sebagai gambar PNG
- FR-12: Desain kartu QR mengikuti spesifikasi Section 7.3 plan (palet hijau/navy + emas, ornamen geometris, quiet zone terjaga)

### 5.3 Modul Buka/Akhiri Sesi
- FR-13: Admin dapat membuka sesi liqa baru (tombol "Buka Sesi") — insert ke `sessions` dengan `is_open=true`, `dibuka_at=now()`
- FR-14: Unique index `one_open_session_per_group` mencegah dua sesi terbuka bersamaan di grup yang sama
- FR-15: Selama sesi terbuka, tombol "Buka Sesi" berubah menjadi "Scan Absen" dan "Akhiri Sesi"
- FR-16: Admin dapat mengakhiri sesi (tombol "Akhiri Sesi") — update `is_open=false`, `ditutup_at=now()`
- FR-17: Setelah sesi diakhiri, tampilkan ringkasan kehadiran sesi tersebut (total hadir/izin/alpa)
- FR-18: Super Admin dapat membuka/mengakhiri sesi untuk grup mana pun

### 5.4 Modul Scan Absen
- FR-19: Halaman scan kamera hanya aktif jika ada sesi terbuka di grup Admin tersebut
- FR-20: Kamera membaca QR anggota → ekstrak `qr_token`
- FR-21: Aplikasi memanggil RPC `get_profile_by_token(token)` — bukan query langsung ke tabel `profiles`
- FR-22: Tampilkan data anggota (nama, NIM, prodi, kelas, nama kelompok) hasil lookup
- FR-23: Admin menekan "Konfirmasi Hadir" → insert ke `attendances` dengan status `hadir` (default)
- FR-24: Cegah absen dobel via unique constraint `(session_id, user_id)`
- FR-25: Admin dapat mengubah status menjadi `izin` atau `alpa` saat konfirmasi
- FR-26: Notifikasi sukses/"Sudah diabsen sebelumnya" tampil di layar

### 5.5 Modul Tambah Anggota
- FR-27: Admin dapat melihat daftar anggota dengan `group_id IS NULL` dan `status_akun = 'aktif'`
- FR-28: Admin dapat mencari anggota berdasarkan nama/NIM
- FR-29: Admin dapat menetapkan anggota ke kelompoknya → update `profiles.group_id`
- FR-30: RLS policy `admin assign anggota tanpa grup` memastikan admin hanya bisa assign anggota tanpa grup ke group miliknya sendiri
- FR-31: Super Admin dapat menetapkan anggota ke grup mana pun

### 5.6 Modul Manajemen Kelompok
- FR-32: Super Admin dapat CRUD kelompok (nama kelompok, deskripsi, murabbi_id)
- FR-33: Super Admin dapat menetapkan/mengganti Murabbi untuk suatu kelompok
- FR-34: Super Admin dapat melihat daftar semua kelompok beserta jumlah anggota dan murabbi-nya

### 5.7 Modul Dashboard Monitoring
- FR-35: Super Admin melihat ringkasan progress semua kelompok di laman utama `/dashboard`
- FR-36: Dashboard menampilkan: jumlah sesi berjalan hari ini, tingkat kehadiran per kelompok, aktivitas admin (siapa yang sudah/belum buka sesi)
- FR-37: Dashboard menampilkan tren kehadiran anggota dari waktu ke waktu (grafik sederhana)
- FR-38: Data dashboard diperbarui secara realtime via Supabase Realtime

### 5.8 Modul Laporan
- FR-39: Super Admin dapat melihat laporan kehadiran dengan filter: kelompok, rentang tanggal, angkatan
- FR-40: Laporan menampilkan rekap per anggota: total hadir, izin, alpa
- FR-41: Super Admin dapat mengexport laporan ke format Excel (.xlsx) via SheetJS
- FR-42: Super Admin dapat mengexport laporan ke format PDF via jsPDF

---

## 6. Non-Functional Requirements

| Kategori | Requirement |
|---|---|
| **Keamanan** | RLS aktif di semua tabel (`profiles`, `groups`, `sessions`, `attendances`) — tidak ada tabel yang terbuka penuh |
| **Keamanan** | Lookup `qr_token` hanya via RPC `get_profile_by_token` (security definer) — bukan query langsung dari client |
| **Keamanan** | `qr_token` digenerate sebagai random hex 16 byte — bukan NIM/nama yang mudah ditebak |
| **Keamanan** | Unique constraint `(session_id, user_id)` di `attendances` untuk cegah absen dobel |
| **Keamanan** | Status akun `pending` mencegah user asal daftar langsung bisa absen |
| **Keamanan** | Admin hanya bisa akses data groupnya sendiri (kecuali super_admin) — dijamin oleh RLS |
| **Performa** | Single Page Application dengan lazy loading route per role |
| **Performa** | QR code digenerate client-side (library `qrcode`) — tidak perlu server round-trip |
| **Responsivitas** | Mobile First — semua halaman berfungsi di viewport 320px ke atas |
| **Realtime** | Subscription Supabase Realtime untuk update dashboard scan absen |
| **Ketersediaan** | Hosting frontend di Vercel/Netlify, backend di Supabase Cloud |

---

## 7. Data Model (Ringkasan)

Empat entitas utama sesuai ERD:

| Entitas | Relasi | Catatan |
|---|---|---|
| **profiles** | `N:1` ke groups, `1:N` ke attendances | Extends `auth.users`; punya `qr_token` unik & `role` (user/admin/super_admin) |
| **groups** | `1:N` ke profiles (anggota), `1:1` ke profiles (murabbi), `1:N` ke sessions | Setiap grup punya satu murabbi |
| **sessions** | `N:1` ke groups, `1:N` ke attendances | Hanya satu sesi `is_open=true` per grup dalam satu waktu |
| **attendances** | `N:1` ke sessions, `N:1` ke profiles (user & scanned_by) | Unique `(session_id, user_id)` cegah dobel |

Lihat diagram ERD lengkap di `plan-aplikasi-absensi-qr.md#section-2`.

---

## 8. Alur Utama

### 8.1 Registrasi & Aktivasi Akun
1. User buka `/register`, isi form (nama, NIM, prodi, kelas, angkatan, email, password)
2. Supabase Auth `signUp()` → trigger `on_auth_user_created` insert ke `profiles` dengan `qr_token` acak, status `pending`
3. Super Admin lihat daftar akun pending di tab Approval → approve & assign `group_id`
4. Status berubah `aktif` → User bisa login penuh, lihat kartu QR

### 8.2 Buka Sesi → Scan Absen → Akhiri Sesi
1. Admin buka `/beranda`, tekan **"Buka Sesi"** → insert `sessions` (is_open=true)
2. Tombol berubah → Admin masuk ke halaman scan kamera
3. Admin arahkan kamera ke QR anggota → sistem ekstrak `qr_token`
4. Panggil RPC `get_profile_by_token(token)` → tampil data anggota
5. Admin konfirmasi → insert `attendances` (session_id, user_id, scanned_by)
6. Ulangi step 3-5 untuk anggota lain
7. Admin tekan **"Akhiri Sesi"** → update `is_open=false`, `ditutup_at=now()` → tampil ringkasan

### 8.3 Laporan (Super Admin)
1. Super Admin buka tab Laporan
2. Pilih filter: kelompok / rentang tanggal / angkatan
3. Sistem query `attendances` join `sessions`, `profiles`, `groups`
4. Tampilkan rekap per anggota (total hadir/izin/alpa) + per sesi
5. Export ke Excel (.xlsx) atau PDF

---

## 9. Acceptance Criteria per Modul

| Modul | Kriteria Sukses |
|---|---|
| **Auth** | User bisa register → muncul di daftar pending → Super Admin approve → user bisa login penuh. Trigger auto-insert profile berjalan. |
| **Kartu QR** | QR tergenerate dari `qr_token`, tampil dengan frame Islamic (hijau+emas, ornamen geometris), quiet zone bersih, bisa di-download. |
| **Buka/Akhiri Sesi** | Admin bisa buka sesi → muncul unique constraint error jika coba buka sesi lain di grup sama → Admin bisa akhiri sesi → ringkasan tampil. |
| **Scan Absen** | Kamera aktif → scan QR → tampil data anggota (nama, NIM, prodi, kelas, kelompok) → konfirmasi → insert attendance → notifikasi sukses. Absen dobel di sesi sama ditolak. |
| **Tambah Anggota** | Admin lihat daftar anggota tanpa grup → search → assign ke grupnya → anggota pindah ke kelompoknya. |
| **Manajemen Kelompok** | Super Admin bisa CRUD kelompok + assign murabbi. |
| **Dashboard Monitoring** | Super Admin lihat progress semua kelompok realtime — grafik kehadiran, aktivitas admin, tren. |
| **Laporan** | Filter bekerja → data sesuai filter → export Excel/PDF berhasil dengan format benar. |

---

## 10. Out of Scope

Fitur berikut sengaja **tidak dikerjakan** di versi pertama:
- Upload foto profil / avatar ke Supabase Storage
- Notifikasi push (email/SMS/WhatsApp) — hanya notifikasi in-app
- Mode offline / PWA (Progressive Web App)
- Multiple bahasa (i18n) — hanya Bahasa Indonesia
- Fitur chat/discussion antar anggota
- QR code dinamis (token berubah setiap sesi)
- Verifikasi tambahan saat scan (foto otomatis, PIN) — opsional di checklist keamanan
- Role tambahan selain Super Admin, Admin, User
- Integrasi dengan sistem akademik/SIAKAD

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **QR dititipkan ke orang lain** | Anggota titip QR ke teman untuk absen fiktif | (Opsional) Tambah verifikasi PIN/foto saat scan — ditunda ke versi berikutnya |
| **Brute-force qr_token via RPC** | Pencarian token sistematis untuk akses data anggota | RPC `get_profile_by_token` hanya bisa dipanggil oleh role admin/super_admin — rate limiting di edge function opsional |
| **Dua sesi terbuka bersamaan di grup sama** | Data absen terbagi ke dua sesi, kacau | Unique partial index `one_open_session_per_group` — cegah di level database |
| **User non-aktif mencoba absen** | Absen tidak valid | RPC `get_profile_by_token` hanya return profil dengan status `aktif` |
| **SQL injection via token** | Eksploitasi query | RPC menggunakan parameterized query (`where pr.qr_token = token`) — aman dari injection |
| **RLS tidak aktif** | Semua data terekspos publik | Checklist deployment: verifikasi RLS aktif di semua tabel |
| **Token tidak unik (collision)** | Dua anggota punya QR sama | Constraint `unique` di `profiles.qr_token`, random 16 byte (~2^128 kemungkinan) |
