-- 00012: Amalan Yaumi Extension — tahajjud, bacaan_quran, berhalangan

-- ============================================================
-- 1. Tambah kolom baru ke daily_worship_logs
-- ============================================================
ALTER TABLE daily_worship_logs
  ADD COLUMN IF NOT EXISTS tahajjud shalat_status DEFAULT 'belum',
  ADD COLUMN IF NOT EXISTS bacaan_quran jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS berhalangan boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS alasan_berhalangan text DEFAULT '';
