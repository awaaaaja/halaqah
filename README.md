# 📋 Aplikasi Absensi Liqa — QR Code

Sistem absensi digital berbasis **QR Code** untuk kegiatan liqa/halaqah. Memberikan solusi modern menggantikan absensi manual — setiap anggota memiliki kartu QR personal, Murabbi cukup scan untuk mencatat kehadiran, dan Super Admin memonitor seluruh kelompok secara realtime.

**Demo Credentials:**
| Role | Email | Password |
|------|-------|----------|
| Super Admin | super@halaqah.id | password123 |
| Admin/Murabbi | admin@halaqah.id | password123 |
| User/Anggota | user@halaqah.id | password123 |

---

## ✨ Fitur Unggulan

### 👤 User / Anggota
- Registrasi mandiri dengan data akademik (NIM, Prodi, Kelas, Angkatan)
- Kartu QR personal bernuansa Islamic — bisa di-download sebagai gambar
- Riwayat kehadiran permanen per sesi liqa
- Profil pribadi

### 👨‍🏫 Admin / Murabbi
- Buka dan akhiri sesi liqa dengan judul opsional
- Scan QR anggota menggunakan kamera HP (real-time detection)
- Tambah anggota ke kelompok binaan
- Lihat rekap anggota dan riwayat sesi kelompok

### 🛡️ Super Admin
- Dashboard monitoring realtime — tren 7 hari, total anggota, sesi aktif
- Kelola Murabbi dan Kelompok (CRUD)
- Approval akun anggota yang mendaftar
- Laporan lengkap dengan **export Excel (.xlsx)** dan **PDF** (termasuk tabel + timestamp)
- Pengaturan sistem

---

## 🏗️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | Vue 3 (Composition API, `<script setup>`) |
| **Bundler** | Vite 8 |
| **State Management** | Pinia |
| **Routing** | Vue Router (lazy loading per role) |
| **CSS** | Tailwind CSS v3 (Mobile First) |
| **Backend** | Supabase (Postgres, Auth, RLS, Realtime) |
| **QR Generate** | `qrcode` |
| **QR Scan** | `html5-qrcode` |
| **Export** | SheetJS (`xlsx`) + jsPDF + `jspdf-autotable` |
| **QR Download** | `html2canvas` |
| **Hosting** | Vercel / Netlify (frontend) + Supabase Cloud (backend) |

---

## 🚀 Panduan Instalasi

### Prasyarat
- Node.js 18+
- npm 9+
- Akun Supabase (free tier)
- Akun Vercel atau Netlify (deploy)

### Instalasi Lokal

```bash
# Clone repositori
git clone https://github.com/awaaaaja/halaqah.git
cd halaqah

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
```

Edit `.env.local` dan isi credentials Supabase:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Setup Database

1. Buka **SQL Editor** di Supabase Dashboard
2. Jalankan file migrasi secara berurutan:
   - `supabase/migrations/00001_init.sql` — Schema, trigger, RLS
   - `supabase/migrations/00002_fix_rls_recursion.sql` — Fix RLS recursion
3. (Opsional) Jalankan `supabase/seed.sql` untuk data dummy

### Jalankan Development

```bash
npm run dev
```

Akses di `http://localhost:5173`

### Build Produksi

```bash
npm run build
npm run preview
```

---

## 📁 Struktur Proyek

```
aplikasi-absensi-qr/
├── public/
├── supabase/
│   ├── migrations/
│   │   ├── 00001_init.sql          # Schema + trigger + RLS
│   │   └── 00002_fix_rls_recursion.sql
│   └── seed.sql                    # Data dummy
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ui/                     # Button, Card, Modal, Input, dll
│   │   ├── qr/                     # QRCard, QRFrame, QRDownload
│   │   └── layout/
│   │       ├── BottomNav.vue       # Bottom tab bar (dinamis per role)
│   │       ├── AppLayout.vue       # Layout wrapper utama
│   │       └── AuthLayout.vue      # Layout untuk halaman login/register
│   ├── composables/
│   │   ├── useAuth.js
│   │   ├── useSupabase.js
│   │   ├── useSession.js           # Buka/akhiri sesi
│   │   ├── useAttendance.js        # Absen scan & riwayat
│   │   └── useQrScanner.js         # Kamera & scan QR
│   ├── lib/
│   │   └── supabase.js             # Inisialisasi Supabase client
│   ├── router/
│   │   └── index.js                # Router + route guard by role
│   ├── stores/
│   │   ├── authStore.js            # Auth state + profil + role
│   │   └── appStore.js             # Global state (loading, error, notif)
│   ├── views/
│   │   ├── auth/                   # LoginView, RegisterView
│   │   ├── super-admin/            # Dashboard, Kelola Murabbi/Kelompok,
│   │   │                           # Approval Anggota, Laporan, Pengaturan
│   │   ├── admin/                  # Beranda, ScanAbsen, Tambah Anggota,
│   │   │                           # AnggotaSaya, RiwayatSesi
│   │   └── user/                   # QrSaya, Riwayat, Profil
│   ├── App.vue
│   └── style.css
├── .env.example
├── AGENTS.md                       # Panduan AI coding agent
├── PRD.md                          # Product Requirements Document
├── STEPS.md                        # Rencana eksekusi bertahap
├── plan-aplikasi-absensi-qr.md     # Source of truth (schema, RLS, desain)
└── package.json
```

---

## 👥 Manajemen Role & Routing

Setiap role memiliki navigasi dan halaman sendiri yang di-enforce oleh route guard:

| Role | Route Utama | Halaman |
|------|-------------|---------|
| **Super Admin** | `/dashboard` | Dashboard, Kelola Murabbi, Kelola Kelompok, Approval, Laporan, Pengaturan |
| **Admin** | `/beranda` | Beranda (sesi), Scan Absen, Tambah Anggota, Anggota Saya, Riwayat Sesi |
| **User** | `/qr-saya` | Kartu QR, Riwayat Kehadiran, Profil |

Route guard di `src/router/index.js` secara otomatis:
- Mengarahkan ke halaman login jika belum login
- Mengarahkan ke halaman utama sesuai role jika sudah login
- Memblokir akses ke halaman yang bukan sesuai role
- Mengarahkan akun pending ke halaman `/pending`

---

## 🗄️ Database Schema

### Tabel `profiles`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | Referensi auth.users |
| email | text | |
| nama | text | |
| nim | text | Nomor Induk Mahasiswa (unique) |
| prodi | text | Program Studi |
| kelas | text | Kelas |
| angkatan | text | Tahun Angkatan |
| group_id | uuid FK | Referensi groups |
| role | text | `user`, `admin`, `super_admin` |
| qr_token | text UK | Token unik untuk QR Code |
| no_hp | text | |
| status_akun | text | `pending`, `aktif`, `nonaktif` |

### Tabel `groups`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| nama_kelompok | text | Nama kelompok liqa |
| murabbi_id | uuid FK | Referensi profiles (admin) |

### Tabel `sessions`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| group_id | uuid FK | Referensi groups |
| judul | text | Judul sesi (opsional) |
| tanggal | date | Tanggal sesi |
| waktu_mulai | timestamptz | |
| waktu_selesai | timestamptz | Null jika masih berlangsung |
| created_by | uuid FK | Referensi profiles (murabbi) |

### Tabel `attendances`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| session_id | uuid FK | Referensi sessions |
| user_id | uuid FK | Referensi profiles (anggota) |
| scanned_by | uuid FK | Referensi profiles (murabbi) |
| scanned_at | timestamptz | Waktu scan |

### Trigger
- `handle_new_user()` — Otomatis insert ke `profiles` saat user baru daftar (via `signUp`)
- Lengkap dengan `qr_token` acak dan `status_akun = 'pending'`

---

## 📊 Fitur Export & Pelaporan

- **Excel (.xlsx)** — Seluruh data absensi dengan sheet per filter
- **PDF** — Laporan dengan tabel rapi, timestamp, dan judul dinamis
- **Filter** — Kelompok, Status (semua/aktif/selesai), rentang tanggal (coming soon)

---

## 🌐 Deployment

### Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set environment variables di dashboard Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Backend (Supabase)

Sudah otomatis — tinggal pakai project yang sudah di-setup. Pastikan:
- RLS aktif di semua tabel
- Trigger `handle_new_user()` berjalan
- Auth settings → **Confirm email** = off (kebutuhan internal)

---

## 🧪 Testing

```bash
npm run build
```

Pastikan build tanpa error. Cek juga:
- Route guard behavior (coba akses halaman tanpa login)
- RLS policy (coba scan QR dari role berbeda)
- Flow register → pending → approval → aktif
- Flow buka sesi → scan → absen
- Flow super admin → laporan → export

---

## 📄 Lisensi

Hak cipta © 2026 — Dibangun untuk internal liqa/halaqah.

---

Dibangun dengan ❤️ menggunakan Vue 3 + Supabase.
