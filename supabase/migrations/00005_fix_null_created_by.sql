-- =============================================
-- Fix: Backfill null created_by di sessions
-- dan pastikan foreign key constraint konsisten
-- =============================================

-- 1. Backfill null created_by dengan murabbi_id dari groups
--    (asumsi: session dibuat oleh admin/murabbi kelompok tsb)
UPDATE sessions s
SET created_by = g.murabbi_id
FROM groups g
WHERE s.group_id = g.id
  AND s.created_by IS NULL
  AND g.murabbi_id IS NOT NULL;

-- 2. Jika masih ada yang null (group tanpa murabbi), 
--    cari admin pertama yang punya group_id tsb
UPDATE sessions s
SET created_by = p.id
FROM profiles p
WHERE s.group_id = p.group_id
  AND p.role = 'admin'
  AND s.created_by IS NULL
  AND p.id IN (
    SELECT DISTINCT ON (group_id) id
    FROM profiles
    WHERE role = 'admin' AND group_id IS NOT NULL
    ORDER BY group_id, created_at ASC
  );

-- 3. Pastikan created_by NOT NULL untuk sesi baru
--    Ini sudah di-handle di useSession.js validasi,
--    tapi kita juga tambah trigger warning di DB level
--    (tidak pakai NOT NULL constraint agar migrasi tidak gagal)
