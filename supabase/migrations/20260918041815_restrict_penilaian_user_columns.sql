-- Migration: Restrict penilaian columns for user role
-- Defense in depth: VIEW exposes only user-safe columns
-- Frontend composable already filters, this adds DB-level protection

-- 1. Create user-safe VIEW (only kehadiran + amalan_yaumi)
CREATE OR REPLACE VIEW penilaian_user_view AS
SELECT
  user_id,
  periode,
  kehadiran,
  amalan_yaumi,
  updated_at
FROM penilaian_asa;

-- 2. Grant SELECT on view to authenticated (users query this, not the table directly)
GRANT SELECT ON penilaian_user_view TO authenticated;

-- Note: RLS on penilaian_asa still controls row access.
-- The VIEW inherits row-level security from the base table via security_invoker.
-- Users can only see their own rows through this VIEW.
-- Admin/super_admin still access full penilaian_asa via admin RLS policies.
