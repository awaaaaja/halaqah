-- ========== FIX RLS infinite recursion ==========
-- Fungsi security definer untuk ambil role tanpa trigger RLS recursion
create or replace function get_current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Drop policies yang bermasalah (rekursif)
drop policy if exists "user lihat profil sendiri" on profiles;
drop policy if exists "admin assign anggota tanpa grup" on profiles;
drop policy if exists "kelola groups" on groups;
drop policy if exists "admin kelola sesi kelompoknya" on sessions;
drop policy if exists "user lihat riwayat sendiri" on attendances;
drop policy if exists "admin catat kehadiran" on attendances;

-- Re-create dengan fungsi non-rekursif
create policy "user lihat profil sendiri"
    on profiles for select
    using (auth.uid() = id or get_current_user_role() in ('admin','super_admin'));

create policy "admin assign anggota tanpa grup"
    on profiles for update
    using (
        get_current_user_role() in ('admin','super_admin')
        and profiles.group_id is null
    );

create policy "kelola groups"
    on groups for all
    using (get_current_user_role() = 'super_admin');

create policy "admin kelola sesi kelompoknya"
    on sessions for all
    using (
        get_current_user_role() in ('admin','super_admin')
        and (get_current_user_role() = 'super_admin' or exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.group_id = sessions.group_id
        ))
    );

create policy "user lihat riwayat sendiri"
    on attendances for select
    using (auth.uid() = user_id or get_current_user_role() in ('admin','super_admin'));

create policy "admin catat kehadiran"
    on attendances for insert
    with check (get_current_user_role() in ('admin','super_admin'));

-- Fix RPC get_profile_by_token — ganti subquery rekursif dengan fungsi
create or replace function get_profile_by_token(token text)
returns table (id uuid, nama text, nim text, prodi text, kelas text, angkatan text, nama_kelompok text)
language plpgsql security definer as $$
begin
    if get_current_user_role() not in ('admin','super_admin') then
        raise exception 'unauthorized';
    end if;

    return query
    select pr.id, pr.nama, pr.nim, pr.prodi, pr.kelas, pr.angkatan, g.nama_kelompok
    from profiles pr
    left join groups g on g.id = pr.group_id
    where pr.qr_token = token;
end;
$$;
