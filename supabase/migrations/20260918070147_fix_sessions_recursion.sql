-- Fix: Drop rogue policy causing infinite recursion on sessions
-- "user dapat membaca sesi yang dihadirinya" queries attendances,
-- and attendances "admin lihat kehadiran" queries sessions → CYCLE
-- "user lihat sesi kelompoknya" already covers user session visibility

DROP POLICY IF EXISTS "user dapat membaca sesi yang dihadirinya" ON sessions;
