# AGENTS.md — Panduan AI Coding Agent

> **Proyek:** Aplikasi Absensi Liqa Berbasis QR Code
> **Sumber Kebenaran (Source of Truth):**
> - `plan-aplikasi-absensi-qr.md` — seluruh keputusan teknis (schema, RLS, routing, desain)
> - `PRD.md` — product requirements & acceptance criteria

---

## 1. Ringkasan Proyek

Aplikasi absensi berbasis QR Code untuk kegiatan liqa/halaqah. Tiga role (Super Admin, Admin/Murabbi, User/Anggota) dengan halaman berbeda per role. Frontend Vue 3 (Composition API) + Tailwind CSS (Mobile First), backend Supabase (Postgres, Auth, RLS, Edge Functions/RPC, Realtime). Setiap anggota mendapat kartu QR personal bernuansa Islamic; Murabbi membuka sesi dan scan QR untuk absen; Super Admin memonitor progress semua kelompok dan export laporan.

---

## 2. Tech Stack (Wajib — Larang Tambah Library Tanpa Alasan Kuat)

| Layer | Teknologi |
|---|---|
| **Framework** | Vue 3 (Composition API, `<script setup>`) |
| **Bundler** | Vite |
| **State Management** | Pinia |
| **Routing** | Vue Router (lazy loading per role) |
| **CSS** | Tailwind CSS v3+ (Mobile First config) |
| **Backend** | Supabase (Postgres, Auth, RLS, Edge Functions, Realtime) |
| **QR Generate** | `qrcode` (npm) |
| **QR Scan** | `vue-qrcode-reader` atau `html5-qrcode` |
| **Export** | `xlsx` (SheetJS) + `jspdf` |
| **Hosting** | Vercel / Netlify (frontend) + Supabase Cloud (backend) |

**Catatan:** Jika ingin menambah library baru, harus ada alasan tertulis dan disetujui Tech Lead. Tidak boleh asal install.

---

## 3. Struktur Folder Proyek

```
aplikasi-absensi-qr/
├── .opencode/
│   └── skills/
│       └── ui-ux-pro-max/          # Skill desain (hasil uipro init)
├── public/
├── src/
│   ├── assets/
│   │   ├── images/
│   │   └── fonts/
│   ├── components/
│   │   ├── ui/                     # Komponen UI umum (Button, Card, Modal, Input, dsb)
│   │   ├── qr/                     # Komponen QR (QRCard, QRFrame, QRDownload)
│   │   └── layout/
│   │       ├── BottomNav.vue       # Navigasi bottom tab bar (dinamis berdasarkan role)
│   │       ├── AppLayout.vue       # Layout wrapper
│   │       └── AuthLayout.vue      # Layout untuk halaman auth
│   ├── composables/
│   │   ├── useAuth.js              # Auth state & login/logout
│   │   ├── useSupabase.js          # Supabase client instance
│   │   ├── useSession.js           # Sesi liqa (buka/akhiri)
│   │   ├── useAttendance.js         # Absen scan & riwayat
│   │   └── useQrScanner.js         # Kamera & scan QR
│   ├── lib/
│   │   └── supabase.js             # Inisialisasi Supabase client (VITE_SUPABASE_URL & ANON_KEY)
│   ├── router/
│   │   ├── index.js                # Router setup + route guard (redirect by role)
│   │   └── routes.js               # Definisi route per role (bisa dipisah atau dinamis)
│   ├── stores/
│   │   ├── authStore.js            # State auth + profil + role
│   │   └── appStore.js             # State global (loading, error, notifikasi)
│   ├── types/                      # (Optional jika pakai TypeScript)
│   ├── views/
│   │   ├── auth/
│   │   │   ├── LoginView.vue
│   │   │   └── RegisterView.vue
│   │   ├── super-admin/
│   │   │   ├── DashboardView.vue      # Laman utama monitoring
│   │   │   ├── KelolaMurabbiView.vue
│   │   │   ├── KelolaKelompokView.vue
│   │   │   ├── ApprovalAnggotaView.vue
│   │   │   ├── LaporanView.vue
│   │   │   └── PengaturanView.vue
│   │   ├── admin/
│   │   │   ├── BerandaView.vue        # Status sesi + Buka/Akhiri Sesi
│   │   │   ├── ScanAbsenView.vue      # Kamera scan QR
│   │   │   ├── TambahAnggotaView.vue
│   │   │   ├── AnggotaSayaView.vue
│   │   │   └── RiwayatSesiView.vue
│   │   └── user/
│   │       ├── QrSayaView.vue         # Kartu QR Islamic
│   │       ├── RiwayatView.vue        # Catatan kehadiran permanen
│   │       └── ProfilView.vue
│   ├── App.vue
│   └── style.css                      # Tailwind directives + custom font import
├── .env.example
├── .env.local (tidak di-commit)
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
├── PRD.md
├── AGENTS.md (file ini)
├── STEPS.md
└── plan-aplikasi-absensi-qr.md
```

---

## 4. Konvensi UI

### 4.1 Mobile First Wajib
- Semua komponen didesain untuk viewport HP terlebih dahulu (320px–480px)
- Gunakan utility Tailwind **tanpa prefix** untuk ukuran mobile (default)
- Scale up ke tablet/desktop via `md:` dan `lg:` prefix
- Contoh: `class="p-4 md:p-6 lg:p-8"` atau `class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"`

### 4.2 Navigasi
- Navigasi utama = **bottom tab bar** (`BottomNav.vue`) untuk semua role di mobile
- Komponen `BottomNav.vue` bersifat dinamis — menyesuaikan menu berdasarkan `role` user
- Di tablet/desktop, bottom nav bisa di-scale-up menjadi sidebar kiri atau tetap bottom (keputusan desain nanti di tahap polish)
- Setiap tab merepresentasikan route yang valid untuk role tersebut (lihat Section 7 di plan)

### 4.3 Layout Per Role
- Masing-masing role punya root layout berbeda yang membungkus view-nya
- `AppLayout.vue` sebagai wrapper umum, menyisipkan `BottomNav.vue` dan `<router-view>`

---

## 5. Tool Desain — UI UX Pro Max

**Skill ini WAJIB dipakai setiap kali agent mengerjakan task styling/UI.**

Lokasi: `.opencode/skills/ui-ux-pro-max/`

Gunakan skill ini melalui perintah `skill("ui-ux-pro-max")` atau referensi langsung, terutama saat:
- Membangun komponen **Kartu QR bernuansa Islamic** (QrSayaView.vue, QRFrame.vue)
- Menentukan palet warna hijau tua/navy + emas untuk kartu
- Memilih tipografi (serif untuk nama, sans-serif untuk data teknis)
- Mengatur spacing dan konsistensi desain di seluruh komponen UI

Skill ini akan menghasilkan design token yang konsisten (warna, font, spacing, shadow) sehingga aplikasi tidak terlihat generik.

---

## 6. Konvensi Kode

### 6.1 Penamaan File
- **Vue Components:** `PascalCase.vue` — contoh: `QrSayaView.vue`, `BottomNav.vue`
- **JavaScript/TypeScript:** `camelCase.js` — contoh: `useAuth.js`, `authStore.js`
- **Router files:** `index.js`, `routes.js`
- **Views:** `PascalCaseView.vue` — konsisten akhiran `View`

### 6.2 Composition API
- WAJIB gunakan `<script setup>` di semua komponen (kecuali ada alasan kuat untuk Options API)
- Template di `<template>`, style di `<style scoped>` atau `<style>` global jika perlu
- Import composables di bagian atas `<script setup>`

### 6.3 TypeScript
- Opsional — jika dipakai, strict mode wajib diaktifkan
- Definisikan interface/type di folder `src/types/`
- Contoh: `UserProfile`, `SessionData`, `AttendanceRecord`, `GroupData`

### 6.4 State Management
- Pinia store untuk state global (user auth, role, profil)
- Composables untuk logic reusable (useAuth, useSupabase, useSession, useAttendance)
- Hindari menyimpan data di localStorage langsung — gunakan Pinia + persist plugin jika perlu

---

## 7. Aturan Supabase

### 7.1 Akses Data Sensitif — RPC Wajib
- **Jangan** query `profiles.qr_token` langsung dari client dengan anon key — ini rawan brute-force semua data anggota
- Lookup token harus melalui **RPC `get_profile_by_token(token)`** (security definer)
- RPC memvalidasi role caller (hanya admin/super_admin) sebelum return data

### 7.2 RLS Policy
- Semua akses data WAJIB melewati RLS — jangan pernah disable RLS
- Policy sudah didefinisikan di plan — jangan ubah tanpa persetujuan
- Jika ada error RLS, debug dengan Supabase SQL Editor, jangan bypass dengan `service_role` key

### 7.3 Pola Composable untuk Supabase
```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

```javascript
// composables/useSupabase.js
import { supabase } from '@/lib/supabase'

export function useSupabase() {
  return { supabase }
}
```

Jangan hardcode credentials — gunakan `.env` variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

---

## 8. Aturan Git / Commit

- **Format commit message:** `[Fase-#] Pesan singkat` — contoh: `[Fase-1] Init Vue + Vite + Tailwind + Supabase`
- Satu fitur/logical change = satu commit (jangan campur aduk)
- Jangan commit file `.env.local`, `node_modules/`, atau file hasil build
- Branching: kerja di `main` untuk early stage, atau buat branch `feat/nama-fitur` untuk fitur besar
- PR description harus merujuk ke acceptance criteria di PRD.md

---

## 9. Definition of Done (DoD)

Suatu task dinyatakan **selesai** jika semua kriteria berikut terpenuhi:

1. **Build lolos** — `npm run build` tanpa error
2. **Tidak ada console error** — jalankan aplikasi di dev mode, periksa browser console
3. **RLS tervalidasi** — coba akses data dari role yang tidak berhak → harus ditolak (401/403)
4. **Fitur sesuai acceptance criteria** di PRD.md — uji manual tiap skenario
5. **Kode mengikuti konvensi** di AGENTS.md (struktur folder, naming, composition API)
6. **Desain konsisten** — untuk task UI, sudah dirujuk ke skill UI UX Pro Max
7. **Tidak ada regression** — fitur yang sudah berfungsi sebelumnya tetap berfungsi

---

## 10. Larangan (Hal yang Tidak Boleh Dilakukan Agent)

- ❌ **Jangan hardcode credentials** — Supabase URL dan anon key WAJIB dari `.env`
- ❌ **Jangan bypass RLS** — meskipun untuk testing. Gunakan Supabase SQL Editor atau policy adjustment
- ❌ **Jangan membuat tabel/fungsi baru tanpa update ERD dan diskusi dengan Tech Lead**
- ❌ **Jangan query `qr_token` langsung dari client** — harus via RPC `get_profile_by_token`
- ❌ **Jangan skip tahap REVIEW** dalam siklus kerja (Thinking → Build → Review → Fix → Lanjut)
- ❌ **Jangan commit perubahan yang tidak terkait** dengan task yang sedang dikerjakan
- ❌ **Jangan menggunakan `any` type** jika memakai TypeScript — buat interface yang sesuai
- ❌ **Jangan mengubah RLS policy** yang sudah ditetapkan di plan tanpa persetujuan Tech Lead
- ❌ **Jangan deploy** sebelum semua step di STEPS.md selesai dan DoD terpenuhi
