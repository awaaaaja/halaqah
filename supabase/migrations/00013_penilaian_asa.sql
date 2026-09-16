-- Migration 00013: Penilaian ASA + asa_settings

-- ========== ASA_SETTINGS ==========
CREATE TABLE asa_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode     text NOT NULL UNIQUE,
  nama_acara  text NOT NULL DEFAULT 'Adzkia Spiritual Academy',
  tahun       integer NOT NULL,
  tanggal     date[] NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE asa_settings ENABLE ROW LEVEL SECURITY;

CREATE policy "super_admin kelola asa_settings"
  ON asa_settings FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE policy "authenticated lihat asa_settings"
  ON asa_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- ========== PENILAIAN_ASA ==========
CREATE TABLE penilaian_asa (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES profiles(id) NOT NULL,
  periode           text NOT NULL DEFAULT 'ASA-2026',

  sikap_kedisiplinan  integer DEFAULT 0 CHECK (sikap_kedisiplinan >= 0 AND sikap_kedisiplinan <= 100),
  keaktifan           integer DEFAULT 0 CHECK (keaktifan >= 0 AND keaktifan <= 100),
  roadmap             integer DEFAULT 0 CHECK (roadmap >= 0 AND roadmap <= 100),
  posttest            integer DEFAULT 0 CHECK (posttest >= 0 AND posttest <= 100),

  kehadiran           integer DEFAULT 0,
  amalan_yaumi        integer DEFAULT 0,

  total_nilai         numeric(5,2) GENERATED ALWAYS AS (
    (kehadiran * 0.10) + (posttest * 0.10) +
    (sikap_kedisiplinan * 0.20) + (amalan_yaumi * 0.20) +
    (roadmap * 0.20) + (keaktifan * 0.20)
  ) STORED,

  catatan_mentor      text DEFAULT '',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE(user_id, periode)
);

ALTER TABLE penilaian_asa ENABLE ROW LEVEL SECURITY;

CREATE policy "user lihat penilaian sendiri"
  ON penilaian_asa FOR SELECT
  USING (auth.uid() = user_id);

CREATE policy "admin lihat penilaian kelompok"
  ON penilaian_asa FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles target ON target.id = penilaian_asa.user_id
      WHERE p.id = auth.uid() AND p.role = 'admin'
      AND target.group_id = p.group_id
    )
  );

CREATE policy "super_admin kelola penilaian"
  ON penilaian_asa FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- ========== RPC: calculate_penilaian ==========
CREATE OR REPLACE FUNCTION calculate_penilaian(p_user_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_tanggal date[];
  v_group_id uuid;
  v_total_sesi bigint;
  v_hadir bigint;
  v_log record;
  v_score numeric;
  v_total_score numeric := 0;
  v_total_hari integer := 0;
  v_kehadiran integer;
  v_amalan integer;
BEGIN
  SELECT tanggal INTO v_tanggal
  FROM asa_settings
  WHERE periode = p_periode;

  IF v_tanggal IS NULL OR array_length(v_tanggal, 1) = 0 THEN
    RAISE EXCEPTION 'ASA periode % tidak ditemukan atau tanggal belum diatur', p_periode;
  END IF;

  SELECT group_id INTO v_group_id FROM profiles WHERE id = p_user_id;

  SELECT count(*) INTO v_total_sesi
  FROM sessions s
  WHERE s.group_id = v_group_id
    AND s.tanggal = ANY(v_tanggal);

  SELECT count(*) INTO v_hadir
  FROM attendances a
  JOIN sessions s ON s.id = a.session_id
  WHERE a.user_id = p_user_id
    AND a.status = 'hadir'
    AND s.tanggal = ANY(v_tanggal);

  v_kehadiran := CASE
    WHEN v_total_sesi = 0 THEN 0
    ELSE round((v_hadir::numeric / v_total_sesi) * 100)
  END;

  FOR v_log IN
    SELECT * FROM daily_worship_logs
    WHERE user_id = p_user_id
      AND tanggal = ANY(v_tanggal)
  LOOP
    v_total_hari := v_total_hari + 1;

    IF v_log.berhalangan THEN
      v_score := 0;
    ELSE
      v_score := 0;
      IF v_log.shalat_subuh = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_subuh = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_subuh = 'qadha' THEN v_score := v_score + 1; END IF;

      IF v_log.shalat_dzuhur = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_dzuhur = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_dzuhur = 'qadha' THEN v_score := v_score + 1; END IF;

      IF v_log.shalat_ashar = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_ashar = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_ashar = 'qadha' THEN v_score := v_score + 1; END IF;

      IF v_log.shalat_maghrib = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_maghrib = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_maghrib = 'qadha' THEN v_score := v_score + 1; END IF;

      IF v_log.shalat_isya = 'tepat_waktu' THEN v_score := v_score + 4;
      ELSIF v_log.shalat_isya = 'terlambat' THEN v_score := v_score + 2;
      ELSIF v_log.shalat_isya = 'qadha' THEN v_score := v_score + 1; END IF;

      IF v_log.shalat_dhuha THEN v_score := v_score + 3; END IF;

      IF v_log.jumlah_rakaat IS NOT NULL THEN
        v_score := v_score + least(v_log.jumlah_rakaat, 2);
      END IF;

      IF v_log.tahajjud = 'tepat_waktu' THEN v_score := v_score + 5;
      ELSIF v_log.tahajjud = 'terlambat' THEN v_score := v_score + 3;
      ELSIF v_log.tahajjud = 'qadha' THEN v_score := v_score + 1; END IF;

      IF v_log.bacaan_quran IS NOT NULL AND v_log.bacaan_quran != '{}'::jsonb THEN
        v_score := v_score + 5;
      END IF;
    END IF;

    v_total_score := v_total_score + v_score;
  END LOOP;

  v_amalan := CASE
    WHEN v_total_hari = 0 THEN 0
    ELSE round((v_total_score / v_total_hari / 35) * 100)
  END;

  INSERT INTO penilaian_asa (user_id, periode, kehadiran, amalan_yaumi, updated_at)
  VALUES (p_user_id, p_periode, v_kehadiran, v_amalan, now())
  ON CONFLICT (user_id, periode)
  DO UPDATE SET kehadiran = EXCLUDED.kehadiran,
                amalan_yaumi = EXCLUDED.amalan_yaumi,
                updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== RPC: get_penilaian_with_profile ==========
CREATE OR REPLACE FUNCTION get_penilaian_with_profile(
  p_periode text,
  p_group_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nama text,
  nim text,
  nama_kelompok text,
  sikap_kedisiplinan integer,
  keaktifan integer,
  roadmap integer,
  posttest integer,
  kehadiran integer,
  amalan_yaumi integer,
  total_nilai numeric,
  catatan_mentor text,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id, pa.user_id, pr.nama, pr.nim, g.nama_kelompok,
    pa.sikap_kedisiplinan, pa.keaktifan, pa.roadmap, pa.posttest,
    pa.kehadiran, pa.amalan_yaumi, pa.total_nilai, pa.catatan_mentor,
    pa.updated_at
  FROM penilaian_asa pa
  JOIN profiles pr ON pr.id = pa.user_id
  LEFT JOIN groups g ON g.id = pr.group_id
  WHERE pa.periode = p_periode
    AND (p_group_id IS NULL OR pr.group_id = p_group_id)
  ORDER BY pa.total_nilai DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
