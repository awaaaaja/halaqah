-- Migration 00015: Fix penilaian_asa RLS + RPC save manual fields

-- ========== RLS: Add INSERT + UPDATE for admin ==========
CREATE POLICY "admin insert penilaian kelompok"
  ON penilaian_asa FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles target ON target.id = user_id
      WHERE p.id = auth.uid() AND p.role = 'admin'
      AND target.group_id = p.group_id
    )
  );

CREATE POLICY "admin update penilaian kelompok"
  ON penilaian_asa FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles target ON target.id = penilaian_asa.user_id
      WHERE p.id = auth.uid() AND p.role = 'admin'
      AND target.group_id = p.group_id
    )
  );

-- ========== RPC: calculate_penilaian (updated) ==========
-- Now also accepts manual fields from the form
CREATE OR REPLACE FUNCTION calculate_penilaian(
  p_user_id uuid,
  p_periode text,
  p_sikap_kedisiplinan integer DEFAULT NULL,
  p_keaktifan integer DEFAULT NULL,
  p_roadmap integer DEFAULT NULL,
  p_posttest integer DEFAULT NULL,
  p_catatan_mentor text DEFAULT NULL
)
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

  -- Hitung total sesi
  SELECT count(*) INTO v_total_sesi
  FROM sessions s
  WHERE s.group_id = v_group_id
    AND s.tanggal = ANY(v_tanggal);

  -- Hitung sesi hadir
  SELECT count(DISTINCT a.session_id) INTO v_hadir
  FROM attendances a
  JOIN sessions s ON s.id = a.session_id
  WHERE a.user_id = p_user_id
    AND a.status = 'hadir'
    AND s.tanggal = ANY(v_tanggal);

  v_kehadiran := CASE
    WHEN v_total_sesi = 0 THEN 0
    ELSE round((v_hadir::numeric / v_total_sesi) * 100)
  END;

  -- Hitung amalan yaumi
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

  -- Upsert: save BOTH auto (kehadiran, amalan) AND manual fields
  INSERT INTO penilaian_asa (
    user_id, periode, kehadiran, amalan_yaumi,
    sikap_kedisiplinan, keaktifan, roadmap, posttest,
    catatan_mentor, updated_at
  )
  VALUES (
    p_user_id, p_periode, v_kehadiran, v_amalan,
    COALESCE(p_sikap_kedisiplinan, 0),
    COALESCE(p_keaktifan, 0),
    COALESCE(p_roadmap, 0),
    COALESCE(p_posttest, 0),
    COALESCE(p_catatan_mentor, ''),
    now()
  )
  ON CONFLICT (user_id, periode)
  DO UPDATE SET
    kehadiran = EXCLUDED.kehadiran,
    amalan_yaumi = EXCLUDED.amalan_yaumi,
    sikap_kedisiplinan = EXCLUDED.sikap_kedisiplinan,
    keaktifan = EXCLUDED.keaktifan,
    roadmap = EXCLUDED.roadmap,
    posttest = EXCLUDED.posttest,
    catatan_mentor = EXCLUDED.catatan_mentor,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
