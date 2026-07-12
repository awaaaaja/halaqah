# Panduan Penggunaan — Aplikasi Absensi Liqa

**URL:** https://halaqah-chi.vercel.app  
**Tech Stack:** Vue 3 + Supabase (Postgres, Auth, RLS, Edge Functions) + Tailwind CSS

---

## Daftar Isi

1. [Pengenalan Role](#1-pengenalan-role)
2. [Registrasi & Login](#2-registrasi--login)
3. [User (Anggota)](#3-user-anggota)
4. [Admin (Murabbi)](#4-admin-murabbi)
5. [Super Admin](#5-super-admin)
6. [FAQ](#6-faq)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Pengenalan Role

| Role | Deskripsi | Halaman Utama |
|---|---|---|
| **Super Admin** | Koordinator liqa — kelola semua akun, kelompok, pantau progress, export laporan | `/dashboard` |
| **Admin (Murabbi)** | Pembimbing kelompok — buka sesi, scan QR anggota, rekap kehadiran | `/beranda` |
| **User (Anggota)** | Peserta liqa — lihat kartu QR, riwayat kehadiran, profil | `/qr-saya` |

---

## 2. Registrasi & Login

### 2.1 Registrasi Mandiri (Anggota)

1. Buka https://halaqah-chi.vercel.app
2. Klik **"Daftar"** di halaman login
3. Isi form:
   - Email & Password (min 6 karakter)
   - Nama Lengkap
   - NIM, Prodi, Kelas, Angkatan
   - No. HP (opsional)
4. Klik **"Daftar"**
5. Akun otomatis berstatus **pending** — tunggu persetujuan Super Admin
6. Setelah disetujui, login untuk mengakses fitur penuh

### 2.2 Akun Dibuat oleh Super Admin

Super Admin bisa membuat akun langsung (tanpa registrasi). Akun yang dibuat Super Admin langsung **aktif** — bisa login tanpa perlu approval.

### 2.3 Login

1. Masukkan email + password
2. Sistem otomatis mengarahkan ke halaman sesuai role:
   - User → `/qr-saya` (Kartu QR)
   - Admin → `/beranda` (Status sesi)
   - Super Admin → `/dashboard` (Monitoring)

### 2.4 Reset Password

Di halaman login, klik **"Lupa Password?"** — instruksi dikirim ke email.

---

## 3. User (Anggota)

### 3.1 Halaman QR Saya (`/qr-saya`)

Halaman utama setelah login sebagai Anggota.

1. **Kartu QR Personal** — QR code hitam-putih dalam frame Islamic (hijau + emas)
2. **Identitas** — nama, NIM, nama kelompok di bawah QR
3. **Download** — klik tombol download untuk menyimpan kartu sebagai PNG
4. **Penggunaan** — tunjukkan kartu ini ke Murabbi saat scan absen

### 3.2 Riwayat Kehadiran (`/riwayat`)

- Daftar semua sesi liqa yang pernah diikuti
- Informasi: tanggal, judul materi, status kehadiran (Hadir / Izin / Alpa)
- Data tersimpan permanen

### 3.3 Profil (`/profil`)

- **Bisa diedit:** Nama, No. HP
- **Read-only:** Email, NIM, Prodi, Kelas, Angkatan, Role, Kelompok

---

## 4. Admin (Murabbi)

### 4.1 Beranda (`/beranda`)

Menampilkan:
- Status sesi hari ini (Belum dibuka / Sedang berlangsung / Sudah ditutup)
- Ringkasan kelompok (jumlah anggota)
- Tombol **"Buka Sesi"** — memulai sesi absen baru

### 4.2 Scan Absen (`/scan-absen`)

**Prasyarat:** Sesi harus sudah dibuka.

1. Arahkan kamera HP ke QR code anggota
2. Sistem membaca token QR → tampilkan data anggota (nama, NIM, prodi, kelas)
3. Pilih status: **Hadir** (default), **Izin**, atau **Alpa**
4. Klik konfirmasi — absen tercatat
5. Notifikasi sukses/"Sudah diabsen" muncul
6. Scan anggota berikutnya

### 4.3 Buka & Akhiri Sesi

- **Buka Sesi:** Klik tombol "Buka Sesi" di Beranda atau Scan Absen
- Selama sesi terbuka, anggota lain **tidak bisa** diabsen di sesi berbeda di kelompok yang sama
- **Akhiri Sesi:** Klik tombol "Akhiri Sesi" → sistem tampilkan ringkasan:
  - Total Hadir
  - Total Izin
  - Total Alpa
  - Daftar anggota yang hadir

### 4.4 Tambah Anggota (`/tambah-anggota`)

1. Lihat daftar anggota yang belum punya kelompok
2. Cari berdasarkan nama/NIM
3. Klik **"Tambahkan"** → anggota masuk ke kelompok Anda

### 4.5 Anggota Saya (`/anggota-saya`)

- Daftar anggota di kelompok Anda
- Filter/search anggota
- Lihat riwayat kehadiran per anggota

### 4.6 Riwayat Sesi (`/riwayat-sesi`)

- Daftar sesi yang sudah ditutup
- Informasi: tanggal, judul materi, jumlah hadir/izin/alpa
- Klik sesi untuk detail lengkap

---

## 5. Super Admin

### 5.1 Dashboard (`/dashboard`)

Tampilan utama monitoring:
- **Ringkasan:** total kelompok, total anggota aktif
- **Sesi Berjalan:** kelompok mana yang sedang buka sesi & siapa murabbinya
- **Tren Kehadiran 7 Hari:** grafik kehadiran harian
- **Aktivitas Murabbi:** daftar murabbi yang sudah/belum buka sesi minggu ini

### 5.2 Kelola Murabbi (`/dashboard/murabbi`)

1. **Daftar Murabbi** — lihat semua akun dengan role `admin`
2. **Tambah Murabbi** — pilih anggota aktif → jadikan Murabbi
3. **Assign Kelompok** — atur kelompok binaan Murabbi via dropdown

### 5.3 Kelola Kelompok (`/dashboard/kelompok`)

- **Buat kelompok baru:** nama, deskripsi, assign murabbi
- **Edit kelompok:** ubah nama, deskripsi, ganti murabbi
- **Hapus kelompok:** anggota otomatis kehilangan kelompok
- Lihat jumlah anggota per kelompok

### 5.4 Kelola Akun (`/dashboard/akun`)

**Fitur inti — Super Admin bisa membuat & mengelola semua akun.**

#### Membuat Akun Baru
1. Klik **"+ Akun Baru"**
2. Isi form:
   - Email * — sekaligus akun login
   - Password * — minimal 6 karakter
   - Nama Lengkap *
   - NIM, Prodi, Kelas, Angkatan, No. HP
   - Role — **User (Anggota)**, **Admin (Murabbi)**, atau **Super Admin**
   - Kelompok (untuk role user/admin)
3. Klik **"Buat Akun"**
4. Akun langsung aktif — tidak perlu approval

#### Mengelola Akun
- **Cari** — filter nama, NIM, atau email
- **Filter** — by role (Super Admin / Admin / User) atau status (Aktif / Pending / Nonaktif)
- **Edit** — klik tombol "Edit" pada akun → ubah data, role, status, kelompok
- **Aktifkan / Nonaktifkan** — toggle cepat untuk mengaktifkan/menonaktifkan akun

### 5.5 Approval Anggota (`/dashboard/approval`)

- Daftar akun yang mendaftar mandiri dan masih **pending**
- **Setujui** — aktifkan akun
- **Tolak** — nonaktifkan akun

### 5.6 Laporan (`/dashboard/laporan`)

1. **Filter:**
   - Kelompok
   - Rentang tanggal
   - Status kehadiran (Hadir / Izin / Alpa)
2. **Tabel laporan:** nama anggota, NIM, kelompok, total hadir, izin, alpa, Murabbi
3. **Export:**
   - **Excel (.xlsx)** — klik tombol Excel
   - **PDF** — klik tombol PDF

### 5.7 Pengaturan (`/dashboard/pengaturan`)

- Edit profil Super Admin (nama, no. HP)
- Email bersifat read-only

---

## 6. FAQ

### Apakah QR code bisa dipalsukan?
QR code berisi token acak 32 karakter (16 byte hex) yang unique per akun. Brute-force token praktis mustahil (2^128 kemungkinan). Lookup token hanya via RPC yang memvalidasi role admin/super_admin.

### Bagaimana jika anggota titip QR ke orang lain?
Saat ini absen hanya berdasarkan scan QR. Opsi verifikasi tambahan (PIN/foto) bisa ditambahkan di versi mendatang.

### Bisakah dua sesi dibuka di kelompok yang sama?
Tidak. Sistem memiliki unique constraint yang mencegah dua sesi terbuka bersamaan di kelompok yang sama.

### Apakah data bisa hilang?
Data tersimpan di Supabase Cloud. Semua tabel memiliki RLS dan backup otomatis oleh Supabase.

### Bagaimana cara ganti password?
Gunakan fitur "Lupa Password" di halaman login — instruksi dikirim ke email terdaftar.

---

## 7. Troubleshooting

| Masalah | Solusi |
|---|---|
| **Login gagal "Invalid credentials"** | Cek email & password. Reset password jika lupa. |
| **Login berhasil tapi halaman kosong** | Cek status akun — hubungi Super Admin jika status `pending` atau `nonaktif`. |
| **Kamera scan QR tidak muncul** | Pastikan browser sudah memberi izin kamera. Gunakan browser Chrome/Edge terbaru. |
| **"Sesi sudah ditutup" saat scan** | Minta Murabbi membuka sesi terlebih dahulu. |
| **"Sudah diabsen sebelumnya"** | Anggota sudah tercatat absen di sesi ini. |
| **Error saat buat akun** | Cek apakah email sudah terdaftar. Cek koneksi internet. |
| **Halaman tidak ditemukan (404)** | Pastikan URL benar. Login dengan akun yang memiliki akses ke halaman tersebut. |
| **Data tidak muncul setelah approve** | Refresh halaman. Jika masih kosong, logout lalu login kembali. |
