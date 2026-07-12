# 🛠️ Plan Perbaikan — Aplikasi Absensi Liqa

> **Berdasarkan audit menyeluruh:** 13 Juli 2026
> **Audit scope:** Semua role (Super Admin, Admin/Murabbi, User/Anggota), routing, database, UI, konektivitas.

---

## Daftar Singkat

| ID | Prioritas | Area | Status Saat Ini | Target |
|----|-----------|------|-----------------|--------|
| **B1** | 🔴 P1 | Laporan — Filter Status | Filter `status` filter session (salah), bukan attendance → selalu kosong | Filter absensi per status attendance, bukan session |
| **B2** | 🔴 P1 | Approval — RPC | RPC `approve_user` tidak ada di migrasi 00001/00002, ada di 00003/00004 yang belum dijalankan | Jalankan migrasi 00003 + 00004 di Supabase SQL Editor |
| **B3** | 🟡 P2 | Dashboard — Grafik Kelompok | Query `profiles!inner(count)` tidak valid sebagai agregasi; INNER JOIN menghilangkan group tanpa anggota | Ganti pakai `select('id, nama_kelompok')` + hitung anggota via JS |
| **B4** | 🟢 P3 | Profil User | Template kosong / placeholder | Implementasi form edit profil (nama, no_hp) |
| **B5** | 🟢 P3 | Optimasi — Riwayat Sesi Admin | `supabase.from('sessions').select('*').eq('is_open',false)` tanpa limit → semakin lambat seiring waktu | Tambah pagination atau `.limit(20)` |
| **B6** | 🟢 P3 | Code Quality — Hapus import `useAuthStore` tidak terpakai di router | Import ada tapi variabel `authStore` tidak dipakai | Hapus import |

---

## 🔴 B1 — Filter Status di LaporanView

### Lokasi
`src/views/super-admin/LaporanView.vue:29-36`

### Akar Masalah
Filter `filterStatus` membandingkan `i.status` terhadap value filter, namun `i` adalah objek **session** (bukan attendance). Session tidak memiliki field `status` — hasilnya semua session terfilter → tampilan selalu kosong.

```javascript
// ❌ Kode bermasalah
const filteredData = computed(() => {
  let d = allData.value
  if (filterGroup.value) d = d.filter(i => i.group_id === filterGroup.value)
  if (filterStatus.value) {
    d = d.filter(i => i.status === filterStatus.value) // i.status UNDEFINED
  }
  return d
})
```

### Solusi
Ubah filter status menjadi filter **per-attendance** di dalam setiap session. Logika baru: filter sessions yang memiliki **setidaknya satu attendance** dengan status yang dipilih.

```javascript
// ✅ Kode perbaikan
const filteredData = computed(() => {
  let d = allData.value
  if (filterGroup.value) d = d.filter(i => i.group_id === filterGroup.value)
  if (filterStatus.value) {
    d = d.filter(i => i.anggota.some(a => a.status === filterStatus.value))
  }
  return d
})
```

**Efek:** User tetap bisa melihat semua sesi, hanya sesi yang memiliki attendance dengan status terpilih yang ditampilkan. Summary card dan export akan mengikuti data yang sudah difilter.

### Files affected
- `src/views/super-admin/LaporanView.vue` (:29-36)

---

## 🔴 B2 — Migrasi RPC `approve_user` Belum Dijalankan

### Lokasi
`supabase/migrations/00003_approval_rpc.sql`
`supabase/migrations/00004_fix_rpc_auth.sql`
`src/views/super-admin/ApprovalAnggotaView.vue:27-29`

### Akar Masalah
File `00001_init.sql` dan `00002_fix_rls_recursion.sql` sudah dijalankan (sesuai STEPS.md). Namun `00003_approval_rpc.sql` dan `00004_fix_rpc_auth.sql` belum pernah dieksekusi. Akibatnya fungsi `approve_user()` tidak ada di database → Approval Anggota akan gagal dengan error `function approve_user() does not exist`.

### Solusi
Jalankan kedua file migrasi di Supabase SQL Editor secara berurutan:

1. Buka **Supabase Dashboard → SQL Editor**
2. Jalankan isi `supabase/migrations/00003_approval_rpc.sql`
3. Jalankan isi `supabase/migrations/00004_fix_rpc_auth.sql`

Isi migrasi `00003_approval_rpc.sql`:
```sql
create or replace function approve_user(target_user_id uuid, new_status text)
returns void
language plpgsql
security definer
as $$
begin
  if get_current_user_role() != 'super_admin' then
    raise exception 'unauthorized';
  end if;

  if new_status not in ('aktif', 'nonaktif') then
    raise exception 'status must be aktif or nonaktif';
  end if;

  update public.profiles
  set status_akun = new_status
  where id = target_user_id;
end;
$$;
```

Isi migrasi `00004_fix_rpc_auth.sql` menambahkan validasi `auth.uid() is null` dan juga memperbaiki RPC `get_profile_by_token`.

### Files affected
- `supabase/migrations/00003_approval_rpc.sql` (sudah ada, perlu dijalankan)
- `supabase/migrations/00004_fix_rpc_auth.sql` (sudah ada, perlu dijalankan)

---

## 🟡 B3 — Dashboard Group Overview Query

### Lokasi
`src/views/super-admin/DashboardView.vue:35`

### Akar Masalah
Query `profiles!inner(count)` menggunakan sintaks yang tidak sesuai untuk agregasi di Supabase. Supabase tidak memiliki fitur `count` sebagai kolom dalam nested select. Selain itu, `profiles!inner` memaksa INNER JOIN → group tanpa anggota aktif tidak muncul dalam daftar.

```javascript
// ❌ Kode bermasalah
supabase.from('groups')
  .select('id, nama_kelompok, profiles!inner(count)')
  .eq('profiles.status_akun', 'aktif'),
```

Meskipun data group masih bisa diproses (kode di bawahnya melakukan hitung ulang anggota via JS), dua efek samping tetap terjadi:
1. Group tanpa anggota **tidak muncul** di group overview
2. Field `count` di result selalu null/tidak terdefinisi

### Solusi
Ganti query menjadi simple select tanpa join count + filter:

```javascript
// ✅ Kode perbaikan
supabase.from('groups').select('id, nama_kelompok'),
```

Karena kode di bawah sudah menghitung ulang jumlah anggota per group:
```javascript
const groupStats = await Promise.all(groupData.map(async (g) => {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', g.id)
      .eq('status_akun', 'aktif')
    // ...
}))
```

**Efek:** Semua group muncul di overview, termasuk group dengan 0 anggota. Count anggota tetap akurat.

### Files affected
- `src/views/super-admin/DashboardView.vue` (:35)

---

## 🟢 B4 — Profil User Placeholder

### Lokasi
`src/views/user/ProfilView.vue`

### Akar Masalah
Halaman profil user hanya menampilkan teks placeholder:
```html
<template>
  <div>
    <h1 class="text-xl font-bold mb-4">Profil Saya</h1>
    <p class="text-gray-600">Informasi profil akan tampil di sini.</p>
  </div>
</template>
```

### Solusi
Implementasi form edit profil dengan field:
- Nama Lengkap (editable)
- Email (read-only)
- No. HP (editable)
- Informasi read-only: NIM, Prodi, Kelas, Angkatan

### Files affected
- `src/views/user/ProfilView.vue`

---

## 🟢 B5 — Optimasi Riwayat Sesi Admin

### Lokasi
`src/views/admin/RiwayatSesiView.vue:26-33`

### Current Code
```javascript
const { data, error } = await supabase
  .from('sessions')
  .select('id, tanggal, judul_materi, dibuka_at, ditutup_at, is_open')
  .eq('group_id', adminGroupId.value)
  .eq('is_open', false)
  .order('created_at', { ascending: false })
```

Tidak ada `.limit()` — semakin banyak sesi, semakin lambat. Ditambah loop `Promise.all` untuk summary setiap sesi.

### Solusi
```javascript
const { data, error } = await supabase
  .from('sessions')
  .select('id, tanggal, judul_materi, dibuka_at, ditutup_at, is_open')
  .eq('group_id', adminGroupId.value)
  .eq('is_open', false)
  .order('created_at', { ascending: false })
  .limit(20)
```

### Files affected
- `src/views/admin/RiwayatSesiView.vue` (:33)

---

## 🟢 B6 — Cleanup Import Router

### Lokasi
`src/router/index.js:3`

### Current Code
```javascript
import { useAuthStore } from '@/stores/authStore'
```

Variabel `authStore` tidak pernah dipanggil di router guard (sekarang pakai `supabase.auth.getSession()` langsung). Import bisa dihapus untuk menjaga kode bersih.

### Solusi
Hapus baris import `useAuthStore`.

```diff
- import { useAuthStore } from '@/stores/authStore'
```

### Files affected
- `src/router/index.js` (:3)

---

## Ringkasan Perubahan Per File

| File | Perubahan |
|------|-----------|
| `src/views/super-admin/LaporanView.vue` | Fix filter status → `i.anggota.some(a => a.status === filterStatus.value)` |
| `Supabase SQL Editor` | Jalankan migrasi `00003_approval_rpc.sql` + `00004_fix_rpc_auth.sql` |
| `src/views/super-admin/DashboardView.vue` | Hapus `profiles!inner(count)` dan `.eq('profiles.status_akun', 'aktif')` |
| `src/views/user/ProfilView.vue` | Implementasi form edit profil user |
| `src/views/admin/RiwayatSesiView.vue` | Tambah `.limit(20)` di query sessions |
| `src/router/index.js` | Hapus import `useAuthStore` tidak terpakai |

---

## Urutan Eksekusi yang Disarankan

```
Step 1 — 🔴 P1: B2 — Jalankan migrasi 00003 + 00004 di Supabase (prasyarat approval)
Step 2 — 🔴 P1: B1 — Fix filter status LaporanView
Step 3 — 🟡 P2: B3 — Fix Dashboard group overview query
Step 4 — 🟢 P3: B4 — Implement ProfilView user
Step 5 — 🟢 P3: B5 — Optimasi RiwayatSesiView
Step 6 — 🟢 P3: B6 — Cleanup import router
Step 7 — ✅ Build & verify (`npm run build`)
```

Setiap step harus diikuti verifikasi: build tidak error dan fitur berfungsi sesuai harapan.
