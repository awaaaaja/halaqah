-- 00011: performance indexes + RLS hardening (idempotent)

-- ============================================================
-- 1. Performance indexes on FK columns used in RLS + JOINs
-- ============================================================
create index if not exists idx_sessions_group_id on sessions(group_id);
create index if not exists idx_sessions_created_by on sessions(created_by);
create index if not exists idx_attendances_session_id on attendances(session_id);
create index if not exists idx_attendances_user_id on attendances(user_id);
create index if not exists idx_daily_worship_logs_user_id on daily_worship_logs(user_id);
create index if not exists idx_notes_user_id on notes(user_id);

-- ============================================================
-- 2. RLS: restrict groups table — only own group + super_admin
-- ============================================================
-- Drop old overly permissive policies (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS "lihat groups" on groups;
  DROP POLICY IF EXISTS "super_admin kelola groups" on groups;
  DROP POLICY IF EXISTS "admin lihat groups" on groups;
  DROP POLICY IF EXISTS "user lihat groups" on groups;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Super admin: full access
CREATE POLICY "super_admin kelola groups" on groups FOR ALL
  USING (get_current_user_role() = 'super_admin');

-- Admin (murabbi): read own group only
CREATE POLICY "admin lihat groups" on groups FOR SELECT
  USING (
    get_current_user_role() = 'admin'
    and id in (
      select group_id from profiles where id = auth.uid()
    )
  );

-- User: read own group only
CREATE POLICY "user lihat groups" on groups FOR SELECT
  USING (
    get_current_user_role() = 'user'
    and id in (
      select group_id from profiles where id = auth.uid()
    )
  );
