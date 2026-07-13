-- =============================================
-- Migration: 3 Modul Baru
-- Modul 1: Al-Quran (quran_bookmarks)
-- Modul 2: Amalan Yaumi (daily_worship_logs)
-- Modul 3: Catatan/Notebook (notes)
-- =============================================

-- ========== ENUM ==========
CREATE TYPE shalat_status AS ENUM ('tepat_waktu','terlambat','qadha','belum');

-- ========== QURAN BOOKMARKS ==========
CREATE TABLE quran_bookmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) NOT NULL,
    surat_nomor integer NOT NULL,
    ayat_nomor integer NOT NULL DEFAULT 1,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, surat_nomor)
);

ALTER TABLE quran_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user kelola bookmark sendiri"
    ON quran_bookmarks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ========== DAILY WORSHIP LOGS ==========
CREATE TABLE daily_worship_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) NOT NULL,
    tanggal date NOT NULL DEFAULT current_date,
    shalat_subuh shalat_status DEFAULT 'belum',
    shalat_dzuhur shalat_status DEFAULT 'belum',
    shalat_ashar shalat_status DEFAULT 'belum',
    shalat_maghrib shalat_status DEFAULT 'belum',
    shalat_isya shalat_status DEFAULT 'belum',
    shalat_dhuha boolean DEFAULT false,
    jumlah_rakaat integer,
    rawatib_qobliyah jsonb DEFAULT '{}'::jsonb,
    rawatib_badiyah jsonb DEFAULT '{}'::jsonb,
    catatan_harian text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tanggal)
);

ALTER TABLE daily_worship_logs ENABLE ROW LEVEL SECURITY;

-- User: full CRUD on own rows
CREATE POLICY "user kelola amalan sendiri"
    ON daily_worship_logs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admin/Super Admin: read-only (SELECT only)
CREATE POLICY "admin lihat semua amalan"
    ON daily_worship_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin')
        )
    );

-- ========== NOTES (100% PRIVAT) ==========
CREATE TABLE notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) NOT NULL,
    tanggal date NOT NULL DEFAULT current_date,
    lokasi text,
    pemateri text,
    materi text,
    isi_catatan text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- HANYA user yang punya akses. Admin/super_admin: NO POLICY = deny by default.
CREATE POLICY "user kelola catatan sendiri"
    ON notes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ========== TRIGGER: auto-update updated_at ==========
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quran_bookmarks_updated_at
    BEFORE UPDATE ON quran_bookmarks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_daily_worship_logs_updated_at
    BEFORE UPDATE ON daily_worship_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========== ENABLE REALTIME ==========
ALTER PUBLICATION supabase_realtime ADD TABLE daily_worship_logs;
