# Hướng dẫn triển khai nhanh (FPTU HCM)

**Đầu vào:** file ZIP này. **Đầu ra:** 1 URL Vercel để sinh viên đăng ký, 1 trang /admin để BTC quản lý.

1. **Supabase:** tạo project → SQL Editor → chạy `sql/schema.sql`. Sao chép **Connection string Transaction pooler**. Nếu database đã có từ trước, chạy thêm `sql/migrate-002-mssv-lock.sql` trước khi deploy.
2. **GitHub:** tạo repository **Private**, upload toàn bộ file bên trong thư mục gốc của dự án (không upload dữ liệu cá nhân).
3. **Vercel:** Import repository từ https://vercel.com/new; framework `Other`, root directory chứa `package.json`.
4. **Biến môi trường Vercel:** điền `DATABASE_URL`, `ADMIN_PASSWORD` (>=16 ký tự), `AUTH_SECRET` (>=32 ký tự). Tạo chuỗi bí mật bằng `openssl rand -hex 32`.
5. **Deploy** → kiểm tra `https://<ten>.vercel.app/api/health` có trả `{"ok":true}`.
6. Vào `https://<ten>.vercel.app/admin` → đăng nhập → sửa tên 3 ban; tạo các ca cho ngày **27–28/10/2026** với giờ thật đã công bố.
7. **Di chuyển đăng ký cũ:** từ Sites gốc xuất CSV; làm sạch header theo `import-template.csv`; nhập **Chạy thử** và **Chính thức** riêng. Kiểm tra đối soát theo ban, theo ca, theo MSSV.
8. Chạy thử với **hai máy**, sau đó đóng trang cũ và mở đăng ký ở Vercel.

**Lưu ý:** Đây là mã nguồn tái xây dựng, KHÔNG PHẢI mã nguồn xuất từ ChatGPT Sites. Đường dẫn Sites cũ không cho phép đọc riêng database, do đó chưa có dữ liệu nào được chuyển tự động. Bản deploy cũng chưa thể tạo nếu chủ tài khoản chưa liên kết Vercel và Supabase.

Đọc `README.md` để biết đầy đủ giới hạn, thủ tục kiểm thử và bảo vệ dữ liệu sinh viên.
