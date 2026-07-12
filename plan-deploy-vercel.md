# 🚀 Plan Deploy Vercel — Aplikasi Absensi Liqa

> **Frontend:** Vue 3 + Vite  
> **Backend:** Supabase Cloud (sudah running)  
> **Repo:** https://github.com/awaaaaja/halaqah.git

---

## Prasyarat

| Item | Status |
|------|--------|
| Repo GitHub (`awaaaaja/halaqah`) | ✅ |
| `vercel.json` (SPA rewrites + build config) | ✅ |
| Supabase project running | ✅ |
| Migrasi 00001–00004 sudah dijalankan | ✅ |
| `.env.local` tidak di-commit | ✅ (dihandle via Vercel Env Variables) |

---

## Langkah Deployment

### 1. Import Project ke Vercel

| Cara | Langkah |
|------|---------|
| **Via Web Dashboard** | 1. Buka https://vercel.com/new <br> 2. Login dengan GitHub <br> 3. Pilih repo `awaaaaja/halaqah` <br> 4. Klik **Import** |
| **Via CLI (opsional)** | `npx vercel login` → `npx vercel --prod` |

### 2. Konfigurasi Build

Vercel auto-detect dari `vercel.json` — tidak perlu diubah:

| Setting | Value |
|---------|-------|
| **Framework** | Vite (auto-detected) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 3. Environment Variables

Set **2 variabel** di Vercel Dashboard:

```
VITE_SUPABASE_URL = https://fuygtaegkczrzmivfcfl.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1eWd0YWVna2N6cnptaXZmY2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzI2OTIsImV4cCI6MjA5OTM0ODY5Mn0.E4PxsZi5jINK3_WsDxVZaE40bnyy6fq1Et4nQTCumrI
```

> **⚠️ Penting:** Kedua value ini adalah **public key (anon)** — aman untuk frontend. Jangan pernah pakai `service_role` key di Vite env.

### 4. Deploy

- Klik **Deploy** di Vercel Dashboard
- Tunggu ~1-2 menit sampai selesai
- Vercel akan memberikan URL: `https://halaqah.vercel.app`

### 5. (Opsional) Custom Domain

Di Vercel Dashboard → Project Settings → Domains:
- Tambah domain `halaqah.my.id` (atau domain lain)
- Ikuti instruksi DNS Vercel (CNAME ke `cname.vercel-dns.com`)

---

## Post-Deploy Verification

| Test | URL | Caranya |
|------|-----|---------|
| **Login Admin** | `/login` | admin@halaqah.id / Test123! → redirect ke `/beranda` |
| **Login Super Admin** | `/login` | super@halaqah.id / Test123! → redirect ke `/dashboard` |
| **Login User** | `/login` | user@halaqah.id / Test123! → redirect ke `/qr-saya` |
| **Register** | `/register` | Daftar akun baru → redirect ke `/pending` |
| **Buka Sesi + Scan** | `/beranda` → Buka Sesi → `/scan-absen` | Pastikan kamera berfungsi (HTTPS required) |
| **Approval** | `/dashboard/approval` | Setujui/tolak akun pending |
| **Laporan** | `/dashboard/laporan` | Filter, Export Excel, Export PDF |
| **QR Card** | `/qr-saya` | Download kartu QR sebagai PNG |

> **Catatan Kamera:** QR scan WAJIB HTTPS di Vercel (otomatis). Jangan test di `localhost` tanpa HTTPS — kamera tidak akan berfungsi.

---

## Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Blank page (404) | SPA routing | `vercel.json` harus ada rewrite rule ✅ |
| `Supabase URL not found` | Env variable missing | Cek `VITE_SUPABASE_URL` di Vercel Dashboard |
| Kamera error (HTTP) | Non-HTTPS | Vercel HTTPS otomatis ✅ |
| CORS error | Supabase project settings | Cek Supabase Dashboard → Authentication → Settings → Site URL |
| Login success tapi redirect ke `/login` lagi | Session persistence | Cek `VITE_SUPABASE_URL` dan `ANON_KEY` benar |

---

## Rollback (Jika Ada Masalah)

Di Vercel Dashboard:
1. Buka project → **Deployments**
2. Cari deployment terakhir yang stabil
3. Klik ⋮ → **Promote to Production**
