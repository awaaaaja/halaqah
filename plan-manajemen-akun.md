# Plan: Manajemen Akun oleh Super Admin (Tanpa Registrasi)

## 1. Masalah

Saat ini satu-satunya cara membuat akun adalah **self-registration** via `/register`. Super Admin tidak bisa membuatkan akun untuk user/admin baru. Ini merepotkan jika:
- Anggota tidak bisa daftar sendiri (no HP terbatas, gaptek, dll)
- Super Admin ingin langsung membuat akun dengan role tertentu (admin, super_admin)
- Perlu provisioning massal di awal

## 2. Solusi

**Supabase Edge Function** yang dipanggil Super Admin dari panel "Kelola Akun" (tab baru di dashboard Super Admin). Edge Function menggunakan **service_role** untuk memanggil Supabase Admin API (`supabase.auth.admin.createUser()`) — aman karena hanya bisa dipanggil oleh super_admin (divalidasi di dalam function).

### Arsitektur

```
Super Admin UI (Vue)
  → supabase.functions.invoke("admin-create-user", { body })
  → Edge Function (Deno)
      → Validasi caller adalah super_admin
      → auth.admin.createUser({ email, password, ... })
      → insert ke profiles dengan role + data
  → Response: user_id + data profile
```

### Kenapa Edge Function, bukan RPC?
- Supabase Auth Admin API (`admin.createUser()`) hanya tersedia via service_role key — tidak bisa dari SQL RPC
- Edge Function bisa menyimpan service_role key secara aman (environment variable)
- RPC limit untuk operasi auth yang kompleks

## 3. Perubahan yang Dibutuhkan

### 3.1 Edge Function Baru: `admin-create-user`

**File:** `supabase/functions/admin-create-user/index.ts`

```
POST /functions/v1/admin-create-user
Headers: Authorization: Bearer <anon_key>
Body: {
  email: string,
  password: string,
  nama: string,
  nim?: string,
  prodi?: string,
  kelas?: string,
  angkatan?: string,
  no_hp?: string,
  role: "user" | "admin" | "super_admin",
  group_id?: string
}
```

**Logika:**
1. Parse JWT dari Authorization header → extract `sub` (user_id)
2. Query `profiles` untuk cek `role = 'super_admin'` → jika bukan, return 403
3. Panggil `supabase.auth.admin.createUser()` dengan email + password
4. Insert ke `profiles` dengan data lengkap + role + status_akun = 'aktif'
5. Return `{ success: true, user_id, profile }`

### 3.2 Settings Supabase

**Env vars di Edge Function:**
| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://fuygtaegkczrzmivfcfl.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (service_role key dari Supabase Dashboard) |

### 3.3 Halaman Baru: Kelola Akun (Super Admin)

**Route baru:** `/dashboard/akun`
**Tab baru di BottomNav Super Admin:** "Kelola Akun" (di antara "Approval Anggota" dan "Laporan")

**Fitur halaman:**
1. **Tabel/Search daftar semua akun** — filter by role, status_akun, search nama/nim
2. **Tombol "+ Akun Baru"** — modal form untuk create user
3. **Tombol Edit per baris** — ubah role, group_id, status_akun
4. **Tombol Nonaktifkan/Aktifkan** — ubah status_akun

**Form Create Akun:**
| Field | Type | Required | Notes |
|---|---|---|---|
| Email | email | ✅ | Juga dipakai login |
| Password | password | ✅ | Minimal 6 karakter |
| Nama Lengkap | text | ✅ | |
| NIM | text | | Unique |
| Prodi | text | | |
| Kelas | text | | |
| Angkatan | text | | |
| No. HP | tel | | |
| Role | select | ✅ | user / admin / super_admin |
| Kelompok | select | | Hanya untuk role user/admin |

### 3.4 Update Tabel `profiles` — Validasi NIM Unique Handling

Saat ini `nim` punya constraint `unique` di level DB. Edge Function harus handle error duplicate NIM dengan baik (return error message yang jelas).

### 3.5 Update Route Guard

Tidak perlu perubahan — route guard sudah handle role checking.

### 3.6 Perubahan BottomNav

Tambah tab "Kelola Akun" di urutan ke-4 (setelah "Kelola Kelompok", sebelum "Approval"):

| Tab | Route | Ikon |
|---|---|---|
| Dashboard | `/dashboard` | 📊 |
| Murabbi | `/dashboard/murabbi` | 👤 |
| Kelompok | `/dashboard/kelompok` | 👥 |
| **Akun** | **`/dashboard/akun`** | **🔑** |
| Approval | `/dashboard/approval` | ✅ |
| Laporan | `/dashboard/laporan` | 📄 |
| Pengaturan | `/dashboard/pengaturan` | ⚙️ |

### 3.7 Perubahan Existing: KelolaMurabbiView

Fitur "Tambah Murabbi" saat ini hanya bisa mempromosikan user existing (role user → admin). Dengan adanya halaman "Kelola Akun", fitur ini bisa tetap dipertahankan sebagai shortcut, tapi akun baru bisa dibuat langsung dari "Kelola Akun".

## 4. Data Flow

### 4.1 Create Account Flow
```
Super Admin buka /dashboard/akun
→ Klik "+ Akun Baru"
→ Isi form (email, password, nama, role, dll)
→ Submit
→ Frontend: supabase.functions.invoke("admin-create-user", { body })
→ Edge Function: validasi super_admin
→ Edge Function: auth.admin.createUser()
→ Edge Function: insert profiles
→ Response success
→ Frontend: reload tabel akun
→ Toast: "Akun berhasil dibuat"
```

### 4.2 Edit Account Flow (langsung dari client via RLS)
```
Super Admin klik edit di baris akun
→ Modal edit (role, group_id, status_akun)
→ Submit update ke `profiles` table langsung (via RLS — super_admin punya akses)
→ No Edge Function needed for simple field updates
```

### 4.3 Update Status (Aktifkan/Nonaktifkan)
```
Super Admin klik "Nonaktifkan" di baris akun
→ Konfirmasi
→ Update profiles.status_akun via RPC approve_user (existing)
→ Toast sukses
```

## 5. File yang Akan Dibuat/Diubah

| File | Tindakan | Keterangan |
|---|---|---|
| `supabase/functions/admin-create-user/index.ts` | **BUAT** | Edge Function untuk create user via Admin API |
| `supabase/functions/admin-create-user/import_map.json` | **BUAT** | Import map untuk Deno |
| `src/views/super-admin/KelolaAkunView.vue` | **BUAT** | Halaman baru kelola semua akun |
| `src/components/layout/BottomNav.vue` | **UBAH** | Tambah tab "Kelola Akun" |
| `src/router/index.js` | **UBAH** | Tambah route `/dashboard/akun` |

## 6. Dependencies & Prasyarat

1. **Service Role Key** — buka Supabase Dashboard → Project Settings → API → `service_role` key
2. **Supabase CLI login** — `supabase login` dengan access token dari Supabase Dashboard
3. **Deploy Edge Function** — `supabase functions deploy admin-create-user`
4. **Env var Edge Function** — set `SUPABASE_SERVICE_ROLE_KEY` via `supabase secrets set`

## 7. Security Considerations

- ✅ Edge Function memvalidasi caller adalah super_admin sebelum create user
- ✅ Service Role Key hanya disimpan di server (Edge Function env), tidak pernah terekspos ke client
- ✅ Password dikirim via HTTPS, tidak di-log
- ✅ NIM unique constraint tetap dijaga
- ✅ Profile yang dibuat langsung `aktif` — tidak perlu approval (karena dibuat oleh Super Admin yang sudah trusted)

## 8. Task Breakdown (Ordered)

| # | Task | Effort |
|---|---|---|
| 1 | Setup Supabase CLI: `supabase login`, init functions folder | 5 menit |
| 2 | Buat Edge Function `admin-create-user` (Deno) | 30 menit |
| 3 | Set env vars: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` | 5 menit |
| 4 | Deploy Edge Function: `supabase functions deploy admin-create-user` | 5 menit |
| 5 | Buat komposable `useAdminCreateUser.js` untuk invoke Edge Function | 15 menit |
| 6 | Buat `KelolaAkunView.vue` — tabel + search + filter | 45 menit |
| 7 | Buat modal form Create Akun di `KelolaAkunView.vue` | 30 menit |
| 8 | Buat modal Edit Akun (role, group, status) | 20 menit |
| 9 | Update `BottomNav.vue` — tambah tab "Akun" | 5 menit |
| 10 | Update `router/index.js` — tambah route `/dashboard/akun` | 5 menit |
| 11 | Test flow: create akun → login sebagai akun baru | 15 menit |
| 12 | Test security: user biasa coba panggil Edge Function → 403 | 10 menit |

## 9. Edge Function Code (Draft)

```typescript
// supabase/functions/admin-create-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, content-type" } })

  try {
    // 1. Auth header → extract user
    const authHeader = req.headers.get("Authorization") || ""
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get caller identity from JWT
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser()
    if (authError || !caller) throw new Error("Unauthorized")

    // 2. Cek role caller = super_admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single()
    if (profileError || profile?.role !== "super_admin") throw new Error("Forbidden: only super_admin can create users")

    // 3. Parse body
    const { email, password, nama, nim, prodi, kelas, angkatan, no_hp, role, group_id } = await req.json()
    if (!email || !password || !nama || !role) throw new Error("Missing required fields: email, password, nama, role")

    // 4. Create user via Admin API (service_role client)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama }
    })
    if (createError) throw createError

    // 5. Insert profile
    const { data: newProfile, error: insertError } = await adminClient
      .from("profiles")
      .insert({
        id: authUser.user.id,
        nama,
        nim: nim || null,
        prodi: prodi || null,
        kelas: kelas || null,
        angkatan: angkatan || null,
        no_hp: no_hp || null,
        role,
        group_id: group_id || null,
        status_akun: "aktif",
        email,
      })
      .select()
      .single()
    if (insertError) throw insertError

    return new Response(JSON.stringify({ success: true, user_id: authUser.user.id, profile: newProfile }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 400
    })
  }
})
```

## 10. Catatan Penting

- **Halaman "Kelola Akun" ini menggantikan kebutuhan approval flow sebagian** — karena Super Admin bisa langsung membuat akun dengan status `aktif`. Namun halaman Approval tetap dipertahankan untuk user yang daftar mandiri.
- **Password tidak bisa di-reset via Edge Function ini** — reset password tetap via lupa password Supabase Auth (email OTP).
- **Service Role Key** harus dijaga ketat — jangan pernah commit ke repo atau tampilkan di client.
