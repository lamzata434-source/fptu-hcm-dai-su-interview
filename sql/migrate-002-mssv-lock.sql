-- Chay 1 lan trong Supabase SQL Editor cho database da tao tu schema.sql cu,
-- TRUOC KHI deploy ban code co khoa MSSV va lich mo/dong dang ky.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS registration_opens_at timestamptz;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz;

-- Moi MSSV chi gui dang ky 1 lan (co the gom nhieu ban); Admin xoa dong de mo khoa.
CREATE TABLE IF NOT EXISTS registration_locks (
  env text NOT NULL CHECK(env IN ('test','live')),
  student_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(env,student_id)
);
ALTER TABLE registration_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_locks FROM anon, authenticated;

-- Sinh vien da dang ky truoc khi ap dung quy dinh nay xem nhu da dung luot gui cua minh.
INSERT INTO registration_locks(env,student_id)
SELECT DISTINCT env,student_id FROM registrations
ON CONFLICT DO NOTHING;
