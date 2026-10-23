# FPTU HCM · Đăng ký phỏng vấn Đại sứ (Vercel + Supabase)

> **Trạng thái:** mã nguồn **tái xây dựng**, triển khai độc lập. Chưa lấy được mã nguồn gốc và dữ liệu riêng từ ChatGPT Sites. Không có dữ liệu sinh viên thật trong gói này. Chưa triển khai lên tài khoản Vercel/Supabase; cần chủ tài khoản kết nối và thiết lập biến môi trường.

## Đã có chức năng

- Trang sinh viên: Họ và tên + MSSV, chọn ca theo một trong ba ban, mỗi ca 15 phút, tối đa 6 sinh viên.
- Một MSSV chỉ được có **một ca mỗi ban** trong mỗi môi trường. Giữa hai ca thuộc các ban khác nhau của cùng một sinh viên phải có **ít nhất 15 phút nghỉ** (ca 15 phút, nên giờ bắt đầu cách nhau ít nhất 30 phút: 14:00 và 14:30 được, 14:00 và 14:15 không được). Kiểm tra cả ở giao diện và máy chủ, theo mọi thứ tự đăng ký.
- **Mỗi MSSV chỉ gửi đăng ký một lần**: trong lần gửi đó sinh viên chọn được nhiều ban (mỗi ban một ca). Sau khi gửi, MSSV bị khóa; sinh viên không tự sửa, hủy hay đăng ký lại. Admin mở khóa trong mục **KHÓA MSSV** ở `/admin`.
- Gửi nhiều ban là **tất cả hoặc không**: nếu một ca vừa hết chỗ, không ca nào được lưu và sinh viên được báo chọn ca khác.
- **Tạo lịch tự động** ở `/admin`: chọn ban, khoảng ngày, khung giờ, giờ nghỉ và số suất; hệ thống tạo các ca 15 phút, bỏ qua ca trùng/chồng giờ/đã qua và báo lỗi cấu hình cụ thể. Sinh viên thấy lịch mới ngay khi mở lại trang hoặc trong vòng 15 giây.
- Admin sửa được **giờ bắt đầu từng ca** và đặt **giờ tự động mở/đóng đăng ký** (dùng để chạy thử).
- Đăng ký giao dịch nguyên tử dùng PostgreSQL advisory lock theo MSSV và row lock theo slot, tránh giành chỗ cuối và tránh hai ca đụng giờ khi đăng ký đồng thời.
- Hiển thị số chỗ còn, tự tải lại mỗi 15 giây; xem đăng ký trên chính trình duyệt đã đăng ký bằng mã xác nhận ngẫu nhiên lưu ở `localStorage`.
- Quản trị: đăng nhập bằng mật khẩu mạnh và cookie HttpOnly, giới hạn đăng nhập sai theo IP, đổi tên 3 ban, thêm/sửa/khóa/xóa ca, sửa suất, chuyển/hủy đăng ký, hai môi trường `test`/`live` riêng biệt, mở/đóng form, thông báo, xuất CSV, xem trước và nhập CSV.
- Dữ liệu cá nhân chỉ do API của Vercel đọc; website công khai không lộ danh sách sinh viên. Không có khóa Supabase công khai.
- Mặc định **ĐÓNG** đăng ký; lịch trống; tên ban tạm là `Ban 1`, `Ban 2`, `Ban 3` vì chưa có danh mục gốc trong nguồn có thể đọc.

## 1. Tạo database ở Supabase

1. Đăng nhập [Supabase](https://supabase.com/dashboard), tạo Project.
2. Mở **SQL Editor**, dán và chạy toàn bộ [`sql/schema.sql`](sql/schema.sql).
   - Database đã tạo từ bản cũ: chạy thêm [`sql/migrate-002-mssv-lock.sql`](sql/migrate-002-mssv-lock.sql) **trước khi deploy** bản có khóa MSSV.
3. Mở **Connect → Transaction pooler**, sao chép chính xác `DATABASE_URL` (cổng `6543`). Nếu mật khẩu chứa ký tự đặc biệt, URL-encode ký tự đó.
4. Chọn khu vực phù hợp với chính sách lưu trữ dữ liệu của đơn vị.

## 2. Đưa mã nguồn lên GitHub

1. Giải nén gói ZIP.
2. Tạo repo **private** trên GitHub.
3. Upload **nội dung thư mục** `fpt-dai-su-vercel` (tránh upload ZIP nguyên gói).
4. Tuyệt đối không upload `.env`, file CSV dữ liệu thật, thông tin sinh viên hoặc `node_modules`.

Có thể dùng Terminal trong thư mục:

```bash
git init
git add .
git commit -m "FPTU interview scheduler"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## 3. Deploy Vercel

1. Truy cập [Vercel](https://vercel.com/new) → **Add New → Project** → chọn repo GitHub.
2. Framework Preset: **Other**, Root Directory: thư mục chứa `package.json`. Dự án có `vercel.json` và `public` + `api`.
3. Project Settings → **Environment Variables**, tạo ba biến:

   - `DATABASE_URL`: địa chỉ Postgres Supabase, dùng Transaction pooler.
   - `ADMIN_PASSWORD`: mật khẩu riêng mạnh **ít nhất 16 ký tự**.
   - `AUTH_SECRET`: chuỗi bí mật ngẫu nhiên **ít nhất 32 ký tự** (ví dụ tạo bằng `openssl rand -hex 32`).

4. Chọn **Production**, **Preview** và **Development** phù hợp. Không chép biến vào mã nguồn. Deploy (hoặc Redeploy sau khi sửa biến).
5. Thử `https://<ten-du-an>.vercel.app/api/health` → `{"ok":true}` rồi vào `/admin`.

**Lưu ý:** Vercel Hobby có giới hạn sử dụng cá nhân/phi thương mại. Với ứng dụng do phòng ban hoặc trường sử dụng, hãy kiểm tra điều khoản gói và sử dụng tài khoản/gói được đơn vị phê duyệt. Không mặc định gói miễn phí đáp ứng mọi nhu cầu.

## 4. Thiết lập lịch thật trước khi mở form

1. Vào `/admin`, đăng nhập.
2. Đổi `Ban 1`, `Ban 2`, `Ban 3` thành **đúng tên ban tại Sites cũ**.
3. Ở môi trường **Chạy thử**, thêm từng ca theo lịch thật, ngày phỏng vấn dự kiến **27–28/10/2026**, giờ lấy từ hệ thống hiện tại (không tự bịa khung giờ).
4. Đăng ký thử trên hai trình duyệt; xác minh số chỗ giảm và MSSV không được chiếm hai ca trùng nhau.
5. Thêm lịch tương ứng ở môi trường **Chính thức**. Lịch và dữ liệu của hai môi trường hoàn toàn độc lập.
6. Chuyển `Chế độ đang hiển thị` thành Chính thức và `Mở đăng ký` sau khi kiểm tra xong.

## 5. Chuyển dữ liệu từ ChatGPT Sites cũ

### Những gì chưa thể tự động chuyển

Bản sao metadata của Sites chỉ cho thấy URL/project; không chứa tệp mã nguồn hoặc database. **Không thể lấy dữ liệu đăng ký chỉ bằng đường link công khai.** Muốn giữ dữ liệu cũ, cần xuất CSV bằng trang quản trị Sites gốc hoặc dữ liệu được quản trị viên có quyền cung cấp. Không chia sẻ mật khẩu quản trị hoặc mật khẩu database trong chat.

### Quy trình di chuyển an toàn

1. Trong Sites cũ, sử dụng chức năng **Xuất CSV**, ghi nhận số bản ghi theo **Chạy thử** và **Chính thức** riêng biệt.
2. Sao lưu CSV vào nơi an toàn chỉ quản trị viên có quyền truy cập.
3. Trong Vercel `/admin`, tạo **đúng tên ba ban** và các ca có trong dữ liệu Sites cũ, ở môi trường tương ứng.
4. Chọn môi trường cần nhập và upload CSV. Bấm **Xem trước tệp**, kiểm tra số dòng, rồi **Nhập dữ liệu đã xem**.
5. Nếu file gốc có các tên cột khác, chuẩn hóa thành 4 cột bắt buộc `student_name,student_id,committee,start_at` như mẫu [`import-template.csv`](import-template.csv).
6. So sánh tổng bản ghi theo ban, theo ca và MSSV trên cả hai hệ thống. Kiểm tra những dòng bị từ chối (quá số suất, đăng ký trùng, xung đột 15 phút, sai ban).
7. **Đóng đăng ký trên Sites cũ** trước lượt xuất cuối. Nếu cả hai site cùng nhận form thì số liệu sẽ lệch nhau. Khi đã đối soát xong mới công bố link Vercel mới.

**Dữ liệu mẫu** trong template chỉ có header (không có sinh viên thật). File import chấp nhận ISO datetime kèm timezone, ví dụ `2026-10-27T08:00:00+07:00`, hoặc `27/10/2026 08:00`. Tối đa **150 dòng/lượt** và **550KB/tệp**. Hệ thống không tự tạo ca khi nhập CSV; thiếu ca sẽ báo lỗi để không vô tình xếp sai lịch. CSV hiện tại không giữ nguyên ID gốc và timestamp tạo đăng ký gốc.

## 6. Kiểm thử và bảo mật

Tại thư mục dự án:

```bash
npm install
npm test
npm run check
npm run dev
```

Đã chạy kiểm tra cú pháp và 3 test validation. **Chưa** kiểm thử kết nối database thực, API trên Vercel và tải cao do chưa có quyền truy cập hạ tầng. Trước khi mở cho sinh viên:

- Bật HTTPS (Vercel mặc định), dùng `ADMIN_PASSWORD` mạnh, cấu hình WAF/rate limiting cho API public nếu lượng truy cập lớn.
- Bảo vệ quyền truy cập CSV. Không gửi CSV sinh viên qua các kênh công khai.
- Đối chiếu chính sách quyền riêng tư, thời hạn lưu dữ liệu, cơ chế đồng ý và xóa dữ liệu với FPTU.
- Nếu nhiều nhân sự có quyền quản trị, nên nâng cấp sang SSO/role-based auth, thay vì dùng chung một mật khẩu.
- Sau di chuyển, kiểm tra kịch bản hai máy cùng đăng ký suất cuối; kiểm tra 1 MSSV ở 2 ban cùng giờ, hết suất, lịch khóa, chuyển/hủy và đăng nhập sai.

## Những khác biệt với phiên bản Sites hiện tại

- Đây là **bản dựng lại**, không phải exact clone pixel-perfect.
- Tên 3 ban, toàn bộ giờ phỏng vấn, biểu mẫu/nhãn đặc thù và số đăng ký cũ chưa xác nhận từ mã nguồn gốc.
- `Seminar 1`: hiển thị thông báo trong cấu hình; chưa tự động gửi SMS/email.
- Sinh viên không thể tự chỉnh sửa/hủy. Lịch đã lưu chỉ truy cập được trên trình duyệt giữ mã tra cứu; chuyển máy không tự mang theo mã này.
- Trang quản trị chỉ hỗ trợ chuyển **trong cùng ban**, bảo toàn mã tra cứu của sinh viên.

## Cấu trúc

```text
public/     Trang đăng ký /admin và CSS/JS
api/        Vercel Functions (student/admin/import/export)
lib/        PostgreSQL, xác thực, validation, đăng ký giao dịch
sql/        Schema PostgreSQL và thiết lập bảo mật RLS
tests/      Node test
vercel.json Config triển khai
.env.example Danh sách biến môi trường
```
