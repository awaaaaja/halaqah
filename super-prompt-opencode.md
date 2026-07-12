# Super Prompt untuk OpenCode

Copy-paste seluruh blok di bawah ini ke OpenCode.

---

```
Kamu bertindak sebagai Tech Lead + Software Architect untuk proyek "Aplikasi Absensi Liqa Berbasis QR Code" (Vue 3 + Supabase).

Baca terlebih dahulu file plan berikut secara menyeluruh sebelum melakukan apa pun:
`plan-aplikasi-absensi-qr.md`

File itu berisi: ringkasan sistem, prinsip UI Mobile First, role & hak akses, ERD (mermaid), SQL schema, RLS policy, detail fungsional & routing tiap role (Section 7), flow diagram (registrasi, scan absen, laporan), arsitektur sistem, tech stack, roadmap, dan checklist keamanan. Pahami seluruh isinya sebagai satu kesatuan konteks sebelum membuat dokumen apa pun.

Perhatikan khusus requirement UI/UX berikut — WAJIB tercermin di ketiga output:
- **Mobile First tapi tetap scalable ke Desktop**: satu codebase responsif, breakpoint mobile jadi default, di-scale up ke tablet/desktop via `md:`/`lg:` Tailwind. Navigasi utama pakai bottom tab bar per role di mobile.
- **Laman berbeda per role** — bukan satu dashboard generik. Super Admin, Admin, dan User masing-masing punya set halaman/tab sendiri sesuai Section 7 di plan.
- **Super Admin**: laman utama = dashboard monitoring progress liqa (aktivitas admin & kehadiran anggota lintas kelompok), dilengkapi tab-tab: Kelola Murabbi, Kelola Kelompok, Approval Anggota, Laporan, Pengaturan.
- **Admin**: bisa menambahkan anggota dari daftar anggota yang **belum memiliki grup** (`group_id IS NULL`) ke kelompoknya. Admin **wajib membuka sesi liqa** (tombol "Buka Sesi") sebelum bisa mengambil absen, dan mengakhiri sesi lewat tombol "Akhiri Sesi" (update `is_open=false`, `ditutup_at`).
- **User/Anggota**: punya laman QR pribadi (Kartu Saya) dan laman Catatan Kehadiran per sesi liqa yang **tersimpan permanen per akun**.
- **Kartu QR bernuansa Islamic**: ikuti spesifikasi desain di Section 7.3 plan (palet hijau tua/navy + emas, motif geometris Islamic sebagai frame dekoratif, tipografi elegan, quiet-zone QR tidak boleh ditimpa ornamen).

SEBELUM mengerjakan ketiga output di bawah, jalankan dulu langkah instalasi tool bantu desain berikut (WAJIB, jangan skip) sesuai Section 7.4 di plan:

```bash
npm install -g ui-ux-pro-max-cli
cd .
uipro init --ai opencode
```

Tool ini ("UI UX Pro Max") adalah skill design-intelligence yang akan aktif otomatis saat kamu mengerjakan task UI/UX (termasuk styling Kartu QR bernuansa Islamic nanti), untuk memastikan hasil desain konsisten (palet warna, tipografi, spacing) dan tidak generik. Jika instalasi gagal (mis. tidak ada akses npm/internet di environment ini), laporkan errornya ke saya dan lanjutkan dulu ke pembuatan 3 dokumen di bawah tanpa memblokir.

Setelah membaca dan memahami, kerjakan 3 output berikut secara berurutan:

═══════════════════════════════════
OUTPUT 1 — PRD.md
═══════════════════════════════════
Buat file `PRD.md` (Product Requirements Document) berdasarkan plan tersebut, dengan struktur:
1. Latar Belakang & Tujuan Produk
2. Target Pengguna & Role (Super Admin, Admin/Murabbi, User/Anggota) — jabarkan permission masing-masing dalam bentuk tabel
3. Prinsip UI/UX: Mobile First (scalable ke desktop) + laman/navigasi berbeda per role (bottom tab bar) + tema visual Islamic khusus untuk Kartu QR — jelaskan struktur tab/laman tiap role dan spesifikasi desain Kartu QR secara eksplisit sesuai Section 7 di plan
4. User Stories per role (format: "Sebagai [role], saya ingin [aksi], agar [tujuan]") — minimal 5 per role, termasuk story spesifik: admin tambah anggota tanpa grup, admin buka/akhiri sesi, user lihat riwayat per sesi tersimpan permanen, super admin monitoring progress lintas kelompok
5. Functional Requirements — daftar fitur wajib, dikelompokkan per modul (Auth, Kartu QR, Buka/Akhiri Sesi, Scan Absen, Tambah Anggota, Manajemen Kelompok, Dashboard Monitoring, Laporan)
6. Non-Functional Requirements (keamanan, performa, RLS, mobile responsiveness, ketersediaan realtime)
7. Data Model ringkas (rujuk ERD dari plan, jangan duplikasi detail SQL — cukup ringkasan entitas & relasi)
8. Alur Utama (rujuk flow diagram dari plan — deskripsikan singkat tiap alur: registrasi, buka sesi → scan absen → akhiri sesi, laporan)
9. Kriteria Sukses / Acceptance Criteria per modul
10. Out of Scope (hal yang sengaja tidak dikerjakan di versi ini)
11. Risiko & Mitigasi (contoh: QR dititip orang lain, brute-force token, dua sesi terbuka bersamaan, dsb — rujuk checklist keamanan di plan)

═══════════════════════════════════
OUTPUT 2 — AGENTS.md
═══════════════════════════════════
Buat file `AGENTS.md` sebagai panduan kerja untuk AI coding agent (termasuk dirimu sendiri) yang akan membangun repo ini. Isinya:
1. Ringkasan proyek (2-3 kalimat) + link/rujukan ke PRD.md dan plan-aplikasi-absensi-qr.md
2. Tech stack tetap (Vue 3 Composition API, Vite, Pinia, Vue Router, Tailwind, Supabase JS SDK, qrcode, vue-qrcode-reader/html5-qrcode) — larang penambahan library lain tanpa alasan kuat
3. Struktur folder proyek yang wajib diikuti (usulkan struktur folder src/ konkret: components, views, stores, composables, router, lib/supabase, types) — pisahkan komponen/views per role secara jelas, contoh: `views/super-admin/`, `views/admin/`, `views/user/`
4. Konvensi UI: Mobile First wajib — semua komponen didesain untuk viewport HP terlebih dahulu (breakpoint mobile jadi default, tambahkan `md:`/`lg:` di Tailwind untuk scale up), navigasi utama tiap role pakai bottom tab bar komponen (`BottomNav.vue` per role atau dinamis berdasar role)
5. Tool desain: skill **UI UX Pro Max** (`.opencode/skills/ui-ux-pro-max` atau lokasi hasil `uipro init`) HARUS dipakai/dirujuk setiap kali agent mengerjakan task styling/UI — khususnya saat membangun komponen Kartu QR bernuansa Islamic, agar palet warna, tipografi, dan spacing konsisten dan tidak generik
5. Konvensi kode: penamaan file, penamaan variabel, gaya komposisi (`<script setup>`), aturan TypeScript jika dipakai
5. Aturan Supabase: semua akses data sensitif WAJIB lewat RLS/RPC, larangan query langsung `qr_token` dari client dengan anon key, pola penulisan composable untuk supabase client
6. Aturan Git/commit: format commit message, satu step = satu commit/PR kecil
7. Definition of Done per task: harus lolos build, tidak ada console error, RLS tervalidasi, fitur sesuai acceptance criteria di PRD
8. Larangan (hal yang tidak boleh dilakukan agent): jangan hardcode kredensial, jangan bypass RLS, jangan buat tabel baru tanpa update ERD, jangan skip tahap review

═══════════════════════════════════
OUTPUT 3 — STEPS.md (Rencana Eksekusi Bertahap)
═══════════════════════════════════
Buat file `STEPS.md` berisi breakdown pengerjaan dari roadmap di plan (Fase 1-8) menjadi step-step kecil yang bisa dieksekusi satu per satu. Untuk SETIAP step, wajib mengikuti siklus kerja berikut dan dituliskan sebagai template yang harus diikuti saat eksekusi nanti:

   a. **THINKING** — Sebelum coding, jabarkan: apa yang akan dibangun, file apa saja yang akan disentuh/dibuat, dependency ke step sebelumnya, edge case yang perlu diantisipasi
   b. **BUILD** — Implementasi kode sesuai hasil thinking
   c. **REVIEW** — Self-review hasil build: cek terhadap acceptance criteria di PRD.md, cek terhadap aturan di AGENTS.md, cek potensi bug/security hole (khususnya RLS & qr_token)
   d. **FIX / PERBAIKI** — Jika review menemukan masalah, perbaiki sampai tidak ada isu yang tersisa. Ulangi review-fix sampai step benar-benar solid (mantap) sebelum lanjut
   e. **LANJUT STEP BERIKUTNYA** — Hanya boleh lanjut ke step selanjutnya setelah step saat ini clean dari bug dan sudah sesuai definition of done

Susun daftar step berdasarkan fase di roadmap plan, contoh granularitas yang diharapkan (sesuaikan dan detilkan sendiri berdasarkan isi plan):
- Step 0: Install & init tool "UI UX Pro Max" (`npm install -g ui-ux-pro-max-cli` → `uipro init --ai opencode`) — sudah dilakukan di awal prompt ini, cukup verifikasi terpasang dengan benar sebelum lanjut
- Step 1: Setup project Vue + Vite + Tailwind (mobile-first config) + koneksi Supabase
- Step 2: Jalankan SQL schema + RLS + trigger di Supabase (sesuai isi plan, termasuk unique index satu sesi aktif per grup)
- Step 3: Halaman Login & Register + auto-insert profile
- Step 4: Flow approval user (pending → aktif) oleh admin/super admin
- Step 5: Layout dasar per role — bottom tab bar + route guard redirect sesuai role
- Step 6: Komponen "Kartu QR" bernuansa Islamic (User) — generate QR + frame/ornamen sesuai Section 7.3 plan, manfaatkan skill UI UX Pro Max untuk palet & tipografi
- Step 7: Halaman "Riwayat Kehadiran" (User) — list per sesi, tersimpan permanen per akun
- Step 8: RPC `get_profile_by_token` + halaman "Scan Absen" (Admin)
- Step 9: Fitur Buka Sesi & Akhiri Sesi (Admin) — termasuk state UI (kosong/berjalan/ditutup)
- Step 10: Fitur "Tambah Anggota" (Admin) — list anggota `group_id IS NULL` + assign ke grup
- Step 11: Halaman "Anggota Saya" & "Riwayat Sesi" (Admin)
- Step 12: Dashboard Monitoring (Super Admin) — laman utama progress lintas kelompok
- Step 13: Tab-tab Super Admin — Kelola Murabbi, Kelola Kelompok, Approval Anggota
- Step 14: Tab Laporan (Super Admin) — filter + export Excel/PDF
- Step 15: Realtime update saat scan absen
- Step 16: Polish UI responsif (mobile → tablet/desktop) + notifikasi
- Step 17: Deployment

Setiap step di STEPS.md ditulis dalam format checklist dengan 5 sub-poin (Thinking, Build, Review, Fix, Lanjut) sebagai template kosong yang akan diisi/dicentang saat step itu benar-benar dieksekusi — JANGAN eksekusi step-nya sekarang, cukup buat kerangka rencananya dulu di STEPS.md.

═══════════════════════════════════
ATURAN PENGERJAAN
═══════════════════════════════════
- Kerjakan Output 1 → 2 → 3 secara berurutan, jangan diacak.
- Semua output harus konsisten satu sama lain dan konsisten dengan `plan-aplikasi-absensi-qr.md` sebagai sumber kebenaran utama (source of truth) — jangan mengubah/mengurangi keputusan teknis yang sudah ada di plan (schema, RLS, role, dsb), hanya elaborasi menjadi dokumen kerja.
- Jangan mulai coding/implementasi fitur apa pun dulu di tahap ini. Tahap ini murni membuat 3 dokumen: PRD.md, AGENTS.md, STEPS.md.
- Setelah ketiga file selesai dibuat, tampilkan ringkasan singkat isi masing-masing file dan tanyakan konfirmasi ke saya sebelum mulai mengeksekusi Step 1 di STEPS.md.
```
