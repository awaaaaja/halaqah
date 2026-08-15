-- ========== FIX #18: scope SELECT attendances ke kelompok admin ==========
-- Sebelumnya: "user lihat riwayat sendiri" (00002) memberi admin/super_admin
-- akses SELECT GLOBAL ke semua baris attendances (tidak konsisten dengan
-- insert yang sudah di-scope di 00008 #6).
-- Baru: user hanya riwayat sendiri; admin hanya sesi kelompoknya;
--       super_admin tetap semua.

drop policy if exists "user lihat riwayat sendiri" on attendances;

create policy "user lihat riwayat sendiri"
    on attendances for select
    using (auth.uid() = user_id);

create policy "admin lihat kehadiran kelompoknya"
    on attendances for select
    using (
        get_current_user_role() = 'super_admin'
        or exists (
            select 1 from sessions s
            where s.id = attendances.session_id
              and s.group_id = (select group_id from profiles where id = auth.uid())
        )
    );
