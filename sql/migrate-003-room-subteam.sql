-- Chay 1 lan trong Supabase SQL Editor, TRUOC KHI deploy ban code co phong phong van va nhom con.
-- Chi them cot/chi muc moi; khong xoa hay sua phien, dang ky hoac khoa MSSV hien co. Chay lai nhieu lan van an toan.

-- Phong phong van cua tung phien ('' = chua co phong). Khong anh huong neu cot room da duoc them truoc do.
ALTER TABLE slots ADD COLUMN IF NOT EXISTS room text NOT NULL DEFAULT '';

-- Nhom con cua ban, vi du Dai su Truyen thong: Creative Team, Product Team, Digital Team.
ALTER TABLE committees ADD COLUMN IF NOT EXISTS subteams text[] NOT NULL DEFAULT '{}';
-- Phien danh rieng cho mot nhom con ('' = dung chung cho moi nhom cua ban).
ALTER TABLE slots ADD COLUMN IF NOT EXISTS subteam text NOT NULL DEFAULT '';
-- Nhom con sinh vien da chon ('' = ban khong co nhom con, hoac dang ky cu truoc khi co nhom con).
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS subteam text NOT NULL DEFAULT '';

-- Cho phep cac nhom cua cung mot ban phong van cung gio (o cac phong khac nhau):
-- tao rang buoc duy nhat moi gom ca nhom con, roi moi bo rang buoc cu (env,committee_id,start_at).
CREATE UNIQUE INDEX IF NOT EXISTS slots_env_committee_subteam_start ON slots(env,committee_id,subteam,start_at);
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_env_committee_id_start_at_key;

-- Gan 3 nhom con cho ban Dai su Truyen thong (chi khi ban do chua co nhom). Doi trong trang Quan tri neu can.
UPDATE committees SET subteams=ARRAY['Creative Team','Product Team','Digital Team']
WHERE subteams='{}' AND lower(name) LIKE '%truyền thông%';
SELECT id,name,subteams FROM committees ORDER BY id;
