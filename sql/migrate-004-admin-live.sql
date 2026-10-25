-- Chay 1 lan trong Supabase SQL Editor de bat thong bao truc tiep (Supabase Realtime) cho trang Quan tri.
-- Moi khi co dang ky moi / bi huy / bi chuyen phien, database phat mot tin "broadcast" len kenh admin-feed.
-- Tin nhan KHONG chua ten hay MSSV: chi co moi truong, ma dang ky va ma ban. Trang Quan tri nhan tin roi tu tai
-- chi tiet qua API da dang nhap. Neu Realtime gap loi, dang ky van duoc luu binh thuong. Chay lai nhieu lan van an toan.
CREATE OR REPLACE FUNCTION notify_admin_feed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r registrations;
BEGIN
  r := COALESCE(NEW, OLD);
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('op', lower(TG_OP), 'env', r.env, 'id', r.id, 'committee_id', r.committee_id),
      'registration', 'admin-feed', false);
  EXCEPTION WHEN others THEN
    NULL; -- Realtime chua bat hoac loi tam thoi: khong chan viec dang ky.
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION notify_admin_feed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS registrations_admin_feed ON registrations;
CREATE TRIGGER registrations_admin_feed AFTER INSERT OR UPDATE OF slot_id, subteam OR DELETE ON registrations
FOR EACH ROW EXECUTE FUNCTION notify_admin_feed();
