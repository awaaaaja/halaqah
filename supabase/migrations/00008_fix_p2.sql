-- ========== FIX P2 #4: data registrasi hilang saat email confirmation ON ==========
-- Semua field dikirim via user_metadata saat signup; trigger isi kolom dari
-- raw_user_meta_data (tidak butuh sesi aktif, tidak butuh updateProfile pasca-signup).
create or replace function handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, nama, nim, prodi, kelas, angkatan, no_hp, email)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'nama', ''),
        nullif(new.raw_user_meta_data->>'nim', ''),
        nullif(new.raw_user_meta_data->>'prodi', ''),
        nullif(new.raw_user_meta_data->>'kelas', ''),
        nullif(new.raw_user_meta_data->>'angkatan', ''),
        nullif(new.raw_user_meta_data->>'no_hp', ''),
        new.email
    );
    return new;
end;
$$ language plpgsql security definer;

-- ========== FIX P2 #5: qr_token tak boleh dibaca langsung via table ==========
-- Revoke kolom saja TIDAK cukup: selama grant SELECT level tabel ada, kolom tetap
-- terbaca (PG: column revoke tidak menimpa table grant). Maka revoke SELECT tabel
-- lalu re-grant per kolom TANPA qr_token. PostgREST otomatis mengeluarkan kolom
-- ini dari semua select (termasuk select('*')); akses token hanya via RPC.
revoke select on public.profiles from anon, authenticated;
grant select (id, nama, nim, prodi, kelas, angkatan, group_id, role, email, no_hp, status_akun, created_at)
    on public.profiles to anon, authenticated;

create or replace function get_my_qr_token()
returns text
language sql
stable
security definer
as $$
    select qr_token from public.profiles where id = auth.uid()
$$;

-- ========== FIX P2 #6: RPC lookup token dibatasi ke kelompok caller ==========
-- Admin hanya bisa men-scan anggota kelompoknya sendiri; super_admin semua.
create or replace function get_profile_by_token(token text)
returns table (id uuid, nama text, nim text, prodi text, kelas text, angkatan text, nama_kelompok text)
language plpgsql security definer as $$
declare
    caller_role text;
    caller_group uuid;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    caller_role := get_current_user_role();
    if caller_role not in ('admin','super_admin') then
        raise exception 'unauthorized';
    end if;

    if caller_role = 'admin' then
        select pr.group_id into caller_group from profiles pr where pr.id = auth.uid();
        if caller_group is null then
            return;
        end if;
    end if;

    return query
    select pr.id, pr.nama, pr.nim, pr.prodi, pr.kelas, pr.angkatan, g.nama_kelompok
    from profiles pr
    left join groups g on g.id = pr.group_id
    where pr.qr_token = token
      and (caller_role = 'super_admin' or pr.group_id = caller_group);
end;
$$;

-- ========== FIX P2 #6: insert attendances harus di-scope ke kelompok ==========
-- Admin grup A tidak boleh mengabsen ke sesi grup B / anggota bukan kelompoknya.
drop policy if exists "admin catat kehadiran" on attendances;
create policy "admin catat kehadiran"
    on attendances for insert
    with check (
        get_current_user_role() in ('admin','super_admin')
        and exists (
            select 1 from sessions s
            where s.id = attendances.session_id
            and exists (
                select 1 from profiles caller
                where caller.id = auth.uid()
                and (caller.role = 'super_admin' or s.group_id = caller.group_id)
            )
            and exists (
                select 1 from profiles m
                where m.id = attendances.user_id
                and (get_current_user_role() = 'super_admin' or m.group_id = s.group_id)
            )
        )
    );

-- ========== FIX P2 #8: koreksi/hapus absen oleh admin (scoped ke kelompok) ==========
create policy "admin koreksi kehadiran"
    on attendances for update
    using (
        get_current_user_role() in ('admin','super_admin')
        and exists (
            select 1 from sessions s
            where s.id = attendances.session_id
            and exists (
                select 1 from profiles p
                where p.id = auth.uid()
                and (p.role = 'super_admin' or s.group_id = p.group_id)
            )
        )
    )
    with check (get_current_user_role() in ('admin','super_admin'));

create policy "admin hapus kehadiran"
    on attendances for delete
    using (
        get_current_user_role() in ('admin','super_admin')
        and exists (
            select 1 from sessions s
            where s.id = attendances.session_id
            and exists (
                select 1 from profiles p
                where p.id = auth.uid()
                and (p.role = 'super_admin' or s.group_id = p.group_id)
            )
        )
    );

-- ========== FIX P2 #7: realtime untuk attendances & sessions ==========
alter publication supabase_realtime add table public.attendances, public.sessions;