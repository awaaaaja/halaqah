-- Fix get_current_user_role untuk handle null (unauthenticated)
create or replace function get_current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Fix RPC get_profile_by_token - validasi auth.uid() tidak null
create or replace function get_profile_by_token(token text)
returns table (id uuid, nama text, nim text, prodi text, kelas text, angkatan text, nama_kelompok text)
language plpgsql security definer as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

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

-- Fix approve_user - tambah validasi auth.uid() null
create or replace function approve_user(target_user_id uuid, new_status text)
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

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
