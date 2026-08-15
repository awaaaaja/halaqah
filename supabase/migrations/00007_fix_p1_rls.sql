-- ========== FIX P1 #1: user tidak bisa melihat sesi kelompoknya ==========
-- Sebelumnya satu-satunya policy sessions hanya untuk admin/super_admin,
-- sehingga query user yang join sessions!inner ditolak RLS (riwayat & statistik kosong).
create policy "user lihat sesi kelompoknya"
    on sessions for select
    using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.group_id = sessions.group_id
        )
    );

-- ========== FIX P1 #2: policy assign anggota buntu saat group_id diisi ==========
-- USING lama mensyaratkan group_id is null pada baris LAMA. Untuk UPDATE, baris
-- hasil update harus lulus WITH CHECK (fallback ke USING), jadi set group_id
-- membuat RLS menolak. Baris lama yang sudah punya grup juga jadi tak ter-update.
drop policy if exists "admin assign anggota tanpa grup" on profiles;
create policy "admin kelola keanggotaan"
    on profiles for update
    using (get_current_user_role() in ('admin','super_admin'))
    with check (get_current_user_role() in ('admin','super_admin'));

-- ========== FIX P1 #3: satu sumber kebenaran admin<->kelompok ==========
-- profiles.group_id adalah sumber kebenaran (dipakai semua logika admin + RLS).
-- groups.murabbi_id diturunkan via trigger agar tak pernah divergen.
create or replace function sync_murabbi_group()
returns trigger as $$
begin
    update groups set murabbi_id = null where murabbi_id = new.id;
    if new.role = 'admin' and new.group_id is not null then
        update groups set murabbi_id = new.id where id = new.group_id;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_murabbi on profiles;
create trigger trg_sync_murabbi
    after update of role, group_id on profiles
    for each row execute procedure sync_murabbi_group();