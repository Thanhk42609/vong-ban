# Vòng Bạn — mã nguồn mạng xã hội
Full-stack starter: đăng ký/đăng nhập, hồ sơ, ảnh bìa/đại diện, đăng bài chữ/ảnh/video, quyền riêng tư, thích, bình luận, theo dõi, danh sách người dùng và nhắn tin realtime.

## Chạy
Yêu cầu Node.js 20+.
```bash
npm install
cp .env.example .env
npm run dev
```
Mở http://localhost:5173 (API ở cổng 4000). SQLite tự tạo trong `data/`, upload ở `uploads/`.

Trước khi public: đổi JWT_SECRET, dùng HTTPS, giới hạn CORS, thêm xác minh email/khôi phục mật khẩu/rate limit/chặn-báo cáo/kiểm duyệt/sao lưu. File local phù hợp chạy thử một máy; khi triển khai thật nên dùng object storage.
