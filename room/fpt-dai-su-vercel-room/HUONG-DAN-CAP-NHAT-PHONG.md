# Cập nhật số phòng phỏng vấn

Bản cập nhật này thêm trường `room` vào ca phỏng vấn và hiển thị số phòng ở trang đăng ký/lịch đã đăng ký.

## Nếu database Supabase đã tồn tại

1. Mở Supabase Dashboard → SQL Editor.
2. Mở file `sql/migration_add_room.sql`, sao chép toàn bộ nội dung và chạy **một lần**.
3. Không cần xóa hoặc tạo lại database. Ca cũ được giữ nguyên; trường phòng ban đầu để trống.

## Cập nhật code đang chạy trên Vercel

1. Giải nén gói source đã cập nhật.
2. Sao chép các file/thư mục trong gói vào thư mục repository đang kết nối với Vercel, ghi đè các file trùng tên. Không ghi đè hoặc commit `.env.local` nếu bạn có file đó.
3. Kiểm tra các file mới `sql/migration_add_room.sql` và `HUONG-DAN-CAP-NHAT-PHONG.md` cũng được thêm vào repo.
4. Trong VS Code, mở Terminal ở thư mục dự án và chạy:

   ```bash
   npm test
   npm run check
   node --check public/admin.js
   node --check public/app.js
   ```

5. Commit và push lên đúng GitHub repository mà Vercel đang theo dõi. Vercel sẽ tự deploy; nếu không, vào Deployments và chọn Redeploy.
6. Mở `/admin`. Khi tạo ca mới, nhập `Phòng phỏng vấn`. Với ca đã có, nhập số phòng ở cột `Phòng` rồi nhấn `Lưu`.
7. Mở trang sinh viên và nhấn `Tải lại` ở phần “Lịch đã đăng ký trên thiết bị này”. Phòng sẽ hiển thị ở từng lịch.

## Lưu ý

- Cần chạy migration trước khi deploy code mới, nếu không API có thể báo cột `room` chưa tồn tại.
- Nếu một ca chưa được phân phòng, màn hình lịch sẽ ghi “Phòng sẽ được BTC cập nhật”.
- Ví dụ số phòng: `A.203`, `B1-04`, `Phòng 2`. Tối đa 50 ký tự.
