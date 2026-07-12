-- Extension untuk UUID
create extension if not exists "pgcrypto";

-- ========== GROUPS ==========
create table groups (
    id uuid primary key default gen_random_uuid(),
    nama_kelompok text not null,
    murabbi_id uuid references auth.users(id),
    deskripsi text,
    created_at timestamptz default now()
);

-- ========== PROFILES ==========
create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    nama text not null,
    nim text unique,
    prodi text,
    kelas text,
    angkatan text,
    group_id uuid references groups(id),
    role text not null default 'user' check (role in ('user','admin','super_admin')),
    qr_token text unique not null default encode(gen_random_bytes(16), 'hex'),
    email text,
    no_hp text,
    status_akun text default 'pending' check (status_akun in ('pending','aktif','nonaktif')),
    created_at timestamptz default now()
);

-- ========== SESSIONS ==========
create table sessions (
    id uuid primary key default gen_random_uuid(),
    group_id uuid references groups(id) not null,
    tanggal date not null default current_date,
    judul_materi text,
    created_by uuid references profiles(id),
    is_open boolean default true,
    dibuka_at timestamptz default now(),
    ditutup_at timestamptz,
    created_at timestamptz default now()
);

-- Cegah admin membuka lebih dari 1 sesi aktif dalam grup yang sama secara bersamaan
create unique index one_open_session_per_group
    on sessions (group_id)
    where (is_open = true);

-- ========== ATTENDANCES ==========
create table attendances (
    id uuid primary key default gen_random_uuid(),
    session_id uuid references sessions(id) not null,
    user_id uuid references profiles(id) not null,
    scanned_by uuid references profiles(id),
    status text default 'hadir' check (status in ('hadir','izin','alpa')),
    waktu_absen timestamptz default now(),
    catatan text,
    unique (session_id, user_id)
);

-- ========== TRIGGER: auto-insert profile saat user signup ==========
create or replace function handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, nama, email)
    values (new.id, coalesce(new.raw_user_meta_data->>'nama', ''), new.email);
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure handle_new_user();

-- ========== RLS ==========
alter table profiles enable row level security;
alter table groups enable row level security;
alter table sessions enable row level security;
alter table attendances enable row level security;

-- PROFILES
create policy "user lihat profil sendiri"
    on profiles for select
    using (auth.uid() = id or exists (
        select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','super_admin')
    ));

create policy "user update profil sendiri"
    on profiles for update
    using (auth.uid() = id);

create policy "admin assign anggota tanpa grup"
    on profiles for update
    using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','super_admin'))
        and profiles.group_id is null
    );

-- GROUPS
create policy "lihat groups" on groups for select using (auth.role() = 'authenticated');
create policy "kelola groups" on groups for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

-- SESSIONS
create policy "admin kelola sesi kelompoknya"
    on sessions for all
    using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.role in ('admin','super_admin')
            and (p.group_id = sessions.group_id or p.role = 'super_admin')
        )
    );

-- ATTENDANCES
create policy "user lihat riwayat sendiri"
    on attendances for select
    using (auth.uid() = user_id or exists (
        select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','super_admin')
    ));

create policy "admin catat kehadiran"
    on attendances for insert
    with check (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','super_admin'))
    );

-- ========== RPC: get_profile_by_token ==========
create or replace function get_profile_by_token(token text)
returns table (id uuid, nama text, nim text, prodi text, kelas text, angkatan text, nama_kelompok text)
language plpgsql security definer as $$
begin
    if not exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','super_admin')) then
        raise exception 'unauthorized';
    end if;

    return query
    select pr.id, pr.nama, pr.nim, pr.prodi, pr.kelas, pr.angkatan, g.nama_kelompok
    from profiles pr
    left join groups g on g.id = pr.group_id
    where pr.qr_token = token;
end;
$$;
