# PLAN PERBAIKAN BUG & TECH DEBT

> **Proyek:** Aplikasi Absensi Liqa QR
> **Tanggal:** 15 September 2026
> **Sumber:** Analisa manual kode + console error
> **Total Temuan:** 18 issue (4 kritis, 8 medium, 6 minor)

---

## Ringkasan

| Phase | Concern | Jumlah | Estimasi |
|-------|---------|--------|----------|
| 1 | Environment & Bootstrap | 2 | 15 menit |
| 2 | Auth Flow & Router | 1 | 15 menit |
| 3 | Toast Consolidation | 1 | 20 menit |
| 4 | Realtime Over-Fire | 1 | 15 menit |
| 5 | QR Scanner Cleanup | 1 | 10 menit |
| 6 | Dashboard Performance | 1 | 10 menit |
| 7 | UX & Validation | 4 | 50 menit |
| 8 | Code Quality & Minor | 6 | 50 menit |
| **Total** | | **18** | **~3 jam** |

---

## Phase 1: Environment & Bootstrap Fix

**Prioritas:** 🔴 Kritis
**Goal:** Aplikasi bisa jalan tanpa error DNS/auth refresh loop.
**DoD:** `npm run dev` → browser console bersih dari `ERR_NAME_NOT_RESOLVED`.

### Issue 9 — `.env.local` Kosong Supabase Variables

- **Lokasi:** `.env.local`
- **Masalah:** File hanya berisi Vercel OIDC token. Tidak ada `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Ini penyebab utama error `ERR_NAME_NOT_RESOLVED` di console — Supabase client dibuat dengan URL `undefined`.
- **Fix:** Tambahkan variabel Supabase ke `.env.local`:
  ```
  VITE_SUPABASE_URL=https://fuygtaegkczrzmivfcfl.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon-key-dari-supabase-dashboard>
  ```
- **Verifikasi:** Buka browser console → tidak ada error refresh token.

### Issue 10 — Supabase Client Tidak Guard URL Kosong

- **Lokasi:** `src/lib/supabase.js:6-10`
- **Masalah:** `createClient(undefined, undefined)` tetap dijalankan. Error hanya `console.error` lalu lanjut — semua operasi Supabase silently fail.
- **Fix:**
  ```js
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check .env.local')
  }
  ```
- **Verifikasi:** Jalankan tanpa env vars → app throw error yang jelas, bukan silent fail.

---

## Phase 2: Auth Flow & Router Fix

**Prioritas:** 🔴 Kritis
**Goal:** Login/register/logout/redirect berfungsi mulus tanpa flash state.
**DoD:** Buka app → tidak ada flash halaman login sebelum redirect.

### Issue 5 — FetchSession Tanpa Loading Guard

- **Lokasi:** `src/App.vue:18`, `src/stores/authStore.js`
- **Masalah:** `onMounted` panggil `fetchSession()` tapi tidak ada loading state guard di template. Sebelum session loaded, user bisa melihat halaman login sesaat (flash).
- **Fix:**
  1. `App.vue` — tambah conditional rendering:
     ```vue
     <template v-if="authStore.loading" class="loading-skeleton">
       <!-- skeleton placeholder -->
     </template>
     <component v-else :is="layout">
       <router-view />
     </component>
     ```
  2. Verifikasi: refresh halaman → tidak ada flash login page.

---

## Phase 3: Toast System Consolidation

**Prioritas:** 🔴 Kritis
**Goal:** Satu sumber toast di seluruh aplikasi.
**DoD:** Semua toast muncur dari `appStore.showToast()`, tidak ada implementasi lokal.

### Issue 1 — Duplikasi Toast System

- **Lokasi:** `src/views/admin/ScanAbsenView.vue:24-49`
- **Masalah:** `ScanAbsenView` punya toast lokal (`toastMsg`, `toastType`, `toastVisible`, `showToast()`) sendiri. Durasi 3500ms vs global 3000ms. Class `brand-600` vs `emerald-700`.
- **File terpengaruh:**
  - `src/views/admin/ScanAbsenView.vue` — hapus toast lokal
  - `src/stores/appStore.js` — sudah benar, tidak diubah
- **Fix:**
  1. Hapus state toast lokal: `toastMsg`, `toastType`, `toastVisible`
  2. Hapus function `showToast()` lokal
  3. Ganti semua `showToast(...)` → `appStore.showToast(...)`
  4. Hapus `<Teleport to="body">` block toast di template (baris 263-269)
  5. Import `useAppStore` (sudah ada)
- **Verifikasi:** Scan absen → toast muncul di posisi yang sama dengan view lain.

---

## Phase 4: Realtime Over-Fire Fix

**Prioritas:** 🔴 Kritis
**Goal:** Realtime subscription tidak trigger heavy query berulang kali.
**DoD:** Scan absen → counter naik tanpa full page reload.

### Issue 2 — Realtime Handler Panggil `loadData()` Berat

- **Lokasi:** `src/views/admin/BerandaView.vue:212-219`
- **Masalah:** Setiap INSERT ke `attendances` memanggil 3 fungsi:
  - `loadRealtimeCount()` — 1 query (OK)
  - `loadRecentAttendances()` — 1 query (OK)
  - `loadData()` — **7+ query paralel** (BERAT)
- ** dampak:** Saat banyak scan secara bersamaan, `loadData()` dipanggil berulang → unnecessary load.
- **Fix:**
  ```js
  // Sebelum (baris 214-218):
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendances' }, () => {
    loadRealtimeCount()
    loadRecentAttendances()
    loadData()  // ← HAPUS
  })

  // Sesudah:
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendances' }, () => {
    loadRealtimeCount()
    loadRecentAttendances()
  })
  ```
  `loadData()` sudah dipanggil saat `onMounted` via `watch(adminGroupId)` — tidak perlu di-realtime.
- **Verifikasi:** Buka Beranda → scan dari HP lain → counter naik, tidak ada network burst.

---

## Phase 5: QR Scanner Cleanup

**Prioritas:** 🟡 Medium
**Goal:** Scanner tidak leak memory di mobile browser.
**DoD:** Buka scan → tutup → buka lagi → tidak ada error kamera.

### Issue 6 — QR Scanner Instance Leak

- **Lokasi:** `src/composables/useQrScanner.js:71-82`
- **Masalah:** `stopScanner()` nullify `scanner.value` tapi tidak panggil `clear()` pada Html5Qrcode instance. Di mobile browser, ini bisa tahan reference ke kamera lama.
- **Fix:**
  ```js
  async function stopScanner() {
    try {
      if (scanner.value) {
        await scanner.value.stop()
        scanner.value.clear()  // ← TAMBAH
        scanner.value = null
      }
    } catch (e) {
      console.warn('[QR Scanner] Stop error:', e)
    }
    isScanning.value = false
    error.value = ''
  }
  ```
- **Verifikasi:** Buka scan → tutup → buka lagi → kamera normal, tidak ada error.

---

## Phase 6: Dashboard Performance

**Prioritas:** 🟡 Medium
**Goal:** Dashboard super admin tidak lambat saat data banyak.
**DoD:** Dashboard load < 2s dengan 100+ sessions.

### Issue 3 — DashboardView Query Tanpa Pagination

- **Lokasi:** `src/views/super-admin/DashboardView.vue:86-89`
- **Masalah:** Query mengambil SEMUA sessions tanpa filter/limit:
  ```js
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id, group_id')
    .order('created_at', { ascending: false })
  ```
- **Fix:**
  ```js
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id, group_id')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })
  ```
  Group overview cukup data 1 bulan terakhir. Data lama bisa diakses via Laporan.
- **Verifikasi:** Dashboard dengan 200+ sessions → load cepat.

---

## Phase 7: UX & Validation Fixes

**Prioritas:** 🟡 Medium
**Goal:** Form handling lebih robust, tidak ada aksi tanpa konfirmasi.
**DoD:** Semua destructive action punya konfirmasi, tanggal valid.

### Issue 4 — `isActive()` Logic Rapuh

- **Lokasi:** `src/components/layout/BottomNav.vue:78-86`
- **Masalah:** Path checking pakai `route.path.includes('murabbi')` — rapuh, bisa break jika route baru mengandung kata tersebut.
- **Fix:** Refactor pakai `route.name`:
  ```js
  function isActive(itemRoute) {
    const nameMap = {
      '/dashboard': 'Dashboard',
      '/dashboard/murabbi': 'KelolaMurabbi',
      '/dashboard/kelompok': 'KelolaKelompok',
      '/dashboard/akun': 'KelolaAkun',
      '/dashboard/approval': 'ApprovalAnggota',
      '/dashboard/laporan': 'Laporan',
      '/dashboard/pengaturan': 'Pengaturan',
    }
    if (nameMap[itemRoute]) return route.name === nameMap[itemRoute]
    return route.path === itemRoute
  }
  ```

### Issue 12 — LaporanView `dateStart` Bisa > `dateEnd`

- **Lokasi:** `src/views/super-admin/LaporanView.vue:15-16`
- **Masalah:** Tidak ada validasi urutan tanggal.
- **Fix:** Tambah validasi sebelum query:
  ```js
  if (dateStart.value > dateEnd.value) {
    appStore.showToast('Tanggal mulai harus sebelum tanggal akhir', 'warning')
    return
  }
  ```

### Issue 13 — KelolaKelompok Pakai `confirm()` Bawaan Browser

- **Lokasi:** `src/views/super-admin/KelolaKelompokView.vue:92`
- **Masalah:** `confirm()` tidak konsisten dengan style modal custom lain.
- **Fix:** Ganti dengan modal konfirmasi custom (reuse pattern dari logout modal di `BottomNav.vue`).

### Issue 14 — KelolaAkun `toggleStatus` Tanpa Konfirmasi

- **Lokasi:** `src/views/super-admin/KelolaAkunView.vue:100-110`
- **Masalah:** Sekali klik → status langsung berubah.
- **Fix:** Tambah confirmation modal sebelum toggle:
  ```js
  const confirmTarget = ref(null)
  function confirmToggle(user) {
    confirmTarget.value = user
  }
  async function handleToggle() {
    // ...existing logic
    confirmTarget.value = null
  }
  ```

---

## Phase 8: Code Quality & Minor Fixes

**Prioritas:** 🟢 Minor
**Goal:** Konsistensi kode, kurangi tech debt.
**DoD:** Build lolos, tidak ada warning baru.

### Issue 7 — `html2canvas` di `devDependencies`

- **Lokasi:** `package.json:29`
- **Masalah:** `html2canvas` di `devDependencies` tapi kemungkinan dipakai runtime.
- **Fix:** Cek apakah ada import `html2canvas` di kode. Jika ya → pindah ke `dependencies`. Jika tidak → hapus dependency.

### Issue 8 — `created_at` vs `tanggal` Inconsistent

- **Lokasi:** `src/views/admin/BerandaView.vue:78,478`
- **Masalah:** Field `tanggal` vs `created_at` dipakai di tempat berbeda.
- **Fix:** Standardisasi — `tanggal` untuk date display, `created_at` untuk timestamp. Tambah comment di code.

### Issue 15 — `FunctionsHttpError` Import Fragile

- **Lokasi:** `src/composables/useAdminManageUser.js:1`
- **Masalah:** `import { FunctionsHttpError } from '@supabase/supabase-js'` — jika SDK version berubah, build error.
- **Fix:** Ganti dengan generic error handling tanpa import langsung:
  ```js
  if (error?.context?.json) {
    const errBody = await error.context.json()
    throw new Error(errBody.error || error.message)
  }
  ```

### Issue 16 — QRCard Download Font Load

- **Lokasi:** `src/components/qr/QRCard.vue:77,91`
- **Masalah:** Canvas drawing pakai font `'Playfair Display'` tapi tidak tunggu font load.
- **Fix:** Tambah di awal `downloadCard()`:
  ```js
  await document.fonts.ready
  ```

### Issue 17 — `useQuran` Shared State

- **Lokasi:** `src/composables/useQuran.js:7-10`
- **Masalah:** `daftarSurat`, `detailSurat`, `tafsirSurat` dideklarasi di luar factory function → shared antar component.
- **Fix:** Pindahkan refs ke dalam `useQuran()`:
  ```js
  export function useQuran() {
    const daftarSurat = ref([])
    const detailSurat = ref(null)
    // ...
  }
  ```

### Issue 18 — `RiwayatSesiView` Query Tanpa Scope Comment

- **Lokasi:** `src/views/admin/RiwayatSesiView.vue:37-39`
- **Masalah:** Query attendances tanpa explicit scope. RLS handle, tapi tidak ada dokumentasi.
- **Fix:** Tambah comment:
  ```js
  // Scope ke kelompok admin via RLS policy "admin lihat kehadiran kelompoknya"
  const { data: atts } = await supabase
    .from('attendances')
    .select('status, session_id')
    .in('session_id', sessionIds)
  ```

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8
   ↑           ↑          ↑          ↑
 Kritis     Kritis     Kritis     Kritis
```

**Setiap phase wajib:**
1. `npm run build` lolos tanpa error
2. Tidak ada console error baru
3. Fitur terkait berfungsi (uji manual)
4. Commit dengan format: `[Fix-Phase-X] Deskripsi singkat`

---

## Referensi

- `AGENTS.md` — aturan coding & konvensi
- `PRD.md` — acceptance criteria
- `REPORT-ANALISA-SISTEM-ROLE.md` — analisa sebelumnya (RLS fix)
- `plan-aplikasi-absensi-qr.md` — arsitektur & schema
