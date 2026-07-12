-- RPC aman untuk approve/tolak user (hanya super_admin)
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
