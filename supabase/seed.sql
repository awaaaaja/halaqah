-- ========================================
-- Seed Data: 3 Test Users + 1 Kelompok
-- Password: Test123! (sama untuk semua)
-- Jalankan di: Supabase SQL Editor
-- ========================================

-- Hapus data lama (jika ada)
DELETE FROM attendances;
DELETE FROM sessions;
DELETE FROM profiles WHERE email IN ('super@halaqah.id','admin@halaqah.id','user@halaqah.id');
DELETE FROM groups WHERE nama_kelompok = 'Kelompok Al-Furqan';
DELETE FROM auth.users WHERE email IN ('super@halaqah.id','admin@halaqah.id','user@halaqah.id');

-- Buat grup
INSERT INTO groups (nama_kelompok, deskripsi)
VALUES ('Kelompok Al-Furqan', 'Kelompok liqa bimbingan Ust. Ahmad');

-- Buat user via Supabase management functions
DO $$
DECLARE
  uid_super uuid := gen_random_uuid();
  uid_admin uuid := gen_random_uuid();
  uid_user  uuid := gen_random_uuid();
  gid       uuid;
BEGIN
  SELECT id INTO gid FROM groups WHERE nama_kelompok = 'Kelompok Al-Furqan';

  -- Super Admin
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (uid_super, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'super@halaqah.id',
    crypt('Test123!', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"nama":"Super Admin"}',
    now(), now(),
    '', '', '', '');

  -- Admin
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (uid_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@halaqah.id',
    crypt('Test123!', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"nama":"Admin Murabbi"}',
    now(), now(),
    '', '', '', '');

  -- User
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_sent_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (uid_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'user@halaqah.id',
    crypt('Test123!', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"nama":"User Anggota"}',
    now(), now(),
    '', '', '', '');

  -- Update profiles (trigger akan auto-create setelah insert ke auth.users)
  UPDATE profiles SET
    nama = 'Super Admin',
    role = 'super_admin',
    status_akun = 'aktif',
    email = 'super@halaqah.id'
  WHERE id = uid_super;

  UPDATE profiles SET
    nama = 'Admin Murabbi',
    role = 'admin',
    status_akun = 'aktif',
    group_id = gid,
    email = 'admin@halaqah.id'
  WHERE id = uid_admin;

  UPDATE profiles SET
    nama = 'User Anggota',
    role = 'user',
    status_akun = 'aktif',
    group_id = gid,
    nim = '21001',
    prodi = 'Ilmu Komputer',
    angkatan = '2021',
    email = 'user@halaqah.id'
  WHERE id = uid_user;
END $$;
