# 📹 RareBlood Connect - Video Demo Guide
**⏱️ Thời lượng: 7-10 phút | Đối tượng: Hội đồng bảo vệ đồ án**

## 🎬 Bắt Đầu Quay Video Demo

### I. CHUẨN BỊ TRƯỚC KHI QUAY (Split Screen Setup)

#### 1. Khởi động Server
```bash
# 1. Kiểm tra server đang chạy
npm run dev

# 2. Kiểm tra database connected
# Terminal sẽ show: "✅ Connected to MongoDB"
```

#### 2. 📺 SPLIT SCREEN SETUP (Quan trọng nhất!)

**Chia đôi màn hình thành 2 phần:**

**🖥️ NỬA TRÁI (Desktop Browser - 50% màn hình):**
- URL: `http://localhost:3000`
- Dùng cho **Hospital** và **Blood Bank**
- Sẽ chuyển đổi qua lại giữa 2 role này

**📱 NỬA PHẢI (Mobile Emulation - 50% màn hình):**
- URL: `http://localhost:3000` (cùng server)
- Bật **F12 → Toggle Device Toolbar** → Chọn **iPhone** hoặc **Pixel**
- Dùng cho **Donor/User**
- Important: FCM notification sẽ **bật lên trên mobile UI** - cực trực quan!

#### 3. Tài Khoản Test
Sử dụng các tài khoản này để demo:

**🏥 Bệnh Viện (Nửa TRÁI):**
```
Email: hospital@test.com
Password: Hospital@123
```

**🅰️ Ngân Hàng Máu (Nửa TRÁI - chuyển đổi):**
```
Email: bloodbank@test.com
Password: BloodBank@123
```

**🩸 Donor/Người Hiến (Nửa PHẢI - Mobile):**
```
Email: donor1@test.com
Password: Donor@123
```

---

## 🎥 KỊ BẢN QUAY VIDEO (7-10 phút)
**Chỉ 1 luồng duy nhất: Hospital → Reject → Auto-route → SOS → Donor Confirm**

### SCENE 1: Setup & Giới Thiệu (1 phút)
**Nội dung:** Giới thiệu nhanh + Hiện split screen

```
1. Show desktop: "RareBlood Connect - Ứng dụng tìm máu khẩn cấp"
2. Quick overview:
   - Nửa trái: Hospital request + Blood bank response
   - Nửa phải: Donor mobile notifications + confirm
3. Nói: "Bây giờ tôi sẽ demo luồng yêu cầu máu khẩn cấp"
```

---

### SCENE 2: Hospital Tạo Yêu Cầu (1.5 phút)
**Nội dung:** Bệnh viện yêu cầu máu O+ khẩn cấp
**Vị trí:** Nửa TRÁI màn hình

```
1. Nửa trái: Login Hospital
   - Email: hospital@test.com
   - Password: Hospital@123

2. Click "Create Request" hoặc "Donation Request"

3. Điền form:
   - Blood Type: O+
   - Units: 2
   - Urgency: CRITICAL ⚠️ (quan trọng - sẽ trigger SOS)
   - Patient: "Mr. Nguyen Van A"
   - Choose location on map

4. Submit

5. Nói: "Bệnh viện vừa tạo yêu cầu máu khẩn cấp"
```

---

### SCENE 3: Blood Bank Receive + REJECT (1.5 phút)
**Nội dung:** Ngân hàng nhận yêu cầu rồi từ chối
**Vị trí:** Nửa TRÁI màn hình (chuyển sang Blood Bank)

```
1. Nửa trái: Logout Hospital, Login Blood Bank
   - Email: bloodbank@test.com
   - Password: BloodBank@123

2. Go to "Dashboard" hoặc "Incoming Requests"

3. Xem request vừa hospital submit

4. Click "REJECT" button
   - Reason: "Hết máu O+ trong kho"

5. Nói: "Ngân hàng từ chối vì hết máu. 
   BÂY GIỜ HỆ THỐNG SẼ TỰ ĐỘNG:
   - Tìm ngân hàng thay thế
   - HOẶC broadcast SOS tới donor"
```

---

### SCENE 4: Auto-routing + SOS Broadcast (1.5 phút)
**Nội dung:** System tự động tìm ngân hàng khác hoặc broadcast SOS
**Vị trí:** NỬA TRÁI + Xem Console

```
ACTION SEQUENCE:
1. Nửa trái: Quay lại Hospital tab
   - "My Requests" hoặc "Track Request"
   - Xem status vừa đổi thành: "auto_routing" ✅

2. Nó hiển thị: "Searching alternative blood banks..."
   - Blood Bank #2 cách 5km
   - Blood Bank #3 cách 12km
   - ... (nếu có)

3. Nói: "Nếu ngân hàng thay thế cũng từ chối,
   hệ thống sẽ broadcast SOS tới donor"

4. THEO DÕI CONSOLE:
   - Nửa trái: F12 → Console tab
   - **⚠️ PHÓNG TO CONSOLE: Ấn Ctrl+'  ít nhất 2-3 lần (150% zoom)**
   - Nói: "Xem logs - hệ thống đang broadcast FCM tới donor"
   - Logs sẽ show:
     ```
     [SOS Broadcast] Donors matching O+ within 10km: 5
     [FCM] Sending to donor1@... 
     [FCM] Sending to donor2@...
     ```
```

---

### SCENE 5: Donor Nhận Notification (1.5 phút)
**Nội dung:** Donor mobile nhận FCM notification + click confirm
**Vị trí:** NỬA PHẢI màn hình (Mobile)

```
1. Nửa phải: Nếu chưa login, login donor
   - Email: donor1@test.com
   - Password: Donor@123

2. NHƯ MỊ: FCM notification sẽ bật lên trên mobile UI
   - Notification banner: "🚨 O+ máu khẩn cấp cần"
   - Click notification → Dialogs popup

3. Nói: "Donor nhận được SOS alert trên điện thoại"

4. Donor xác nhận:
   - Click "CONFIRM I WILL DONATE" button
   - Xem notification: "Thank you! Hospital notified"

5. Nói: "Bây giờ bệnh viện sẽ thấy donor đã xác nhận"
```

---

### SCENE 6: Hospital Xem Responders (1 phút)
**Nội dung:** Bệnh viện thấy donor đã confirm
**Vị trí:** NỬA TRÁI (quay lại Hospital)

```
1. Nửa trái: Switch lại Hospital tab (nếu chuyển sang console)

2. Refresh "My Requests" page

3. Click vào request đó để xem:
   - Status: "auto_routing" → "SOS_sent"
   - Section "Donor Responses": Xem donor1 đã confirm
   - Show: Donor name, Phone, Distance

4. Nói: "Hospital có list donor đã sẵn sàng

 hiến máu.
   Bệnh viện có thể liên hệ hoặc chờ donor đến.
   Vậy là bệnh viện đã tìm được máu khẩn cấp!"
```

---

### SCENE 7: Wrap-up + Key Takeaways (0.5 phút)

```
Nói:
"RareBlood Connect xử lý 1 yêu cầu máu khẩn cấp chỉ trong vài giây:

✓ Hospital yêu cầu:        T+0 giây
✓ Blood bank search:       T+1-2 giây (2dsphere index)
✓ Bank #1 reject:          T+3 giây
✓ FCM broadcast to donor:  T+4 giây (Pusher real-time)
✓ Donor confirm:           T+5-10 giây
✓ Hospital see responder:  T+6-10 giây

GIẢI PHÁP CÔNG NGHỆ:
- MongoDB 2dsphere (Geospatial search)
- Auto-routing fallback strategy
- Pusher (real-time sync)
- FCM (push notifications)

Cảm ơn! 🩸"
```

---

## 📊 KEY FEATURES DEMO HIGHLIGHTS

### ✅ 3 Công Nghệ Chính Được Demo

1. **Geospatial Search (MongoDB 2dsphere)**
   - Blood bank search: 50km radius
   - Donor broadcast: 10km radius
   - Real-time distance calculation

2. **Auto-Routing Fallback**
   - Bank #1 rejects → Tìm Bank #2 (50km)
   - All reject → SOS broadcast to Donors (10km)

3. **Real-time FCM + Pusher**
   - Notification bật lên trên mobile UI (cực trực quan)
   - Hospital thấy donor response immediately
   - No page refresh needed

---

## 🎯 TIMELINE CHO VIDEO (Total: 7-10 phút)

| Scene | Duration | Activity |
|-------|----------|----------|
| 1. Setup + Intro | 1 min | Split screen + Quick overview |
| 2. Hospital Request | 1.5 min | Create critical O+ request |
| 3. Blood Bank Reject | 1.5 min | Bank từ chối → trigger auto-routing |
| 4. Auto-routing + SOS | 1.5 min | Broadcast FCM + Console logs (ZOOM!) |
| 5. Donor Notification | 1.5 min | Mobile shows FCM popup → confirm |
| 6. Hospital Responders | 1 min | Hospital sees donor confirmed |
| 7. Wrap-up | 0.5 min | Key takeaways |
| **TOTAL** | **~8 min** | |

---

## 🎬 RECORDING TIPS (Split Screen Edition)

### Tools Ghi Hình Được Khuyến Nghị
```
Windows:
- OBS Studio (Free) - Khuyến nghị  
- Camtasia
- Alternative: Windows Game Bar (đơn giản)

Setup để Split Screen:
- Resolution: 1920x1080 or higher
- FPS: 30fps
- Bitrate: 5000 kbps
- Microphone: External mic preferred
```

### ⚠️ CONSOLE ZOOM - CẬP NHẬT QUAN TRỌNG

**Trong SCENE 4 (Auto-routing + SOS):**

```
BƯỚC QUAN TRỌNG:
1. Mở F12 → Console tab (nửa trái desktop)
2. ⚠️ PHÓNG TO CONSOLE:
   - Ấn Ctrl + "+" ít nhất 2-3 lần
   - Target: Console text size ≥ 150%
   - Lý do: Hội đồng cần đọc rõ logs từ xa
3. Xem logs:
   [SOS Broadcast] Searching blood banks...
   [Auto-routing] Bank #1 rejected
   [FCM] Sending notifications to 5 donors
   [Event] Donor response detected
4. Nói: "Xem console - hệ thống đang broadcast FCM"
5. Đừng quên: Phải giữ console visible suốt quá trình broadcast

TIPS:
✅ Zoom console TRƯỚC khi start broadcasting
✅ Không scroll console - để hội đồng thấy toàn bộ logs
✅ Nếu logs scroll quá nhanh, dừng 1-2 giây để hội đồng đọc
```

### Recording Best Practices (Split Screen)
```
✅ DO:
- Chia đôi màn hình rõ ràng (50% - 50%)
- Chuyển đổi giữa hospital/bank nhanh trên nửa trái
- Highlight mobile notification trên nửa phải
- Phóng to console để Hội đồng đọc được
- Nói chậm, rõ ràng, giải thích từng action
- Pause 2 seconds sau mỗi important action

❌ DON'T:
- Mở quá nhiều tabs → confusing
- Scroll console quá nhanh
- Quên phóng to console
- Click quá mau
- Quên explain implications mỗi bước
- Ignore mobile notification bật lên
```

---

## 📝 SCRIPT CHI TIẾT CÓ THỂ DÙNG

### SCENE 1: Setup
```
"Good morning Hội đồng! Đây là RareBlood Connect.

Bạn thấy:
- Nửa TRÁI: Browser desktop cho Bệnh viện + Ngân hàng máu
- Nửa PHẢI: Mobile emulation cho Donor

Hôm nay tôi sẽ demo 1 tình huống:
Bệnh viện cấp cứu cần máu O+ khẩn cấp.
Hệ thống sẽ tự động tìm máu và contact donor.
Toàn bộ quá trình chỉ mất vài giây."
```

### SCENE 2: Hospital Request
```
"Bước 1: Bệnh viện đăng nhập và tạo yêu cầu.
- Blood type: O+
- Urgency: CRITICAL
- Units: 2

Nó submit ngay."
```

### SCENE 3: Bank Reject
```
"Bước 2: Ngân hàng máu nhận được notification.

Nhưng... ngân hàng không có máu O+ sẵn.
Nên họ click REJECT.

Bây giờ, hệ thống sẽ tự động xử lý."
```

### SCENE 4: Auto-routing + Console
```
"Bước 3: TỰ ĐỘNG - Hệ thống tìm kiếm:
- Tìm ngân hàng #2, #3, #4, #5 trong vòng 50km
  (nếu có từ chối cũng)
- Hoặc broadcast SOS tới donor

Xem console - tôi đã phóng to để Hội đồng thấy rõ.

[SOS Broadcast] Searching donors with O+ blood
[FCM] Sending to donor1, donor2, donor3...

Các donor matching O+ trong 10km quanh ngân hàng
sẽ nhận được notification trên điện thoại."
```

### SCENE 5: Donor Mobile
```
"Bước 4: Nhìn nửa PHẢI màn hình - điện thoại donor.

*Notification bật lên:* '🚨 O+ máu khẩn cấp cần - Central Hospital'

Donor click notification.

Donor xem chi tiết:
- Hospital cần 2 units
- Cách đó 5km
- Click CONFIRM → Hospital được thông báo"
```

### SCENE 6: Hospital Sees Response
```
"Bước 5: Quay lại Hospital (nửa trái).

Hospital refresh page.

Bây giờ Hospital thấy:
- Request status: 'auto_routing' → 'SOS_sent'
- 3 donors đã confirm
- Contact info: phone, name, distance

Hospital có thể gọi donor hoặc chờ họ đến.

Vậy là 5 giây, hệ thống đã connect máu + donor + hospital."
```

### OUTRO
```
"Công nghệ sử dụng:
✓ MongoDB 2dsphere - Geospatial queries (<50ms)
✓ Auto-routing logic - Fallback strategy
✓ Pusher - Real-time sync
✓ FCM - Push notifications

Kết quả:
✓ Bệnh viện tìm được máu trong 5-10 giây
✓ Donor được contact trực tiếp
✓ Tăng tỷ lệ đáp ứng khẩn cấp

Cảm ơn! Có câu hỏi gì không? 🩸"
```

---

## ❓ FAQ GIẢI ĐÁP HỘI ĐỒNG

**Q: Tại sao 10km cho donor, 50km cho bank?**
A: Bank có xe delivery. Donor cần gần để nhanh lên car.
   10km = ~15 min driving time ✓

**Q: Nếu 5 banks đều reject?**
A: SOS broadcast direct to donors. 
   System still in auto_routing mode.

**Q: FCM fail (no permission)?**
A: System tạo DonorContactRequest record.
   Donor sẽ thấy in-app notification.

**Q: Real-time sync qua internet?**
A: Pusher - third-party real-time PaaS.
   Broadcast to all connected clients.

---

## 📁 CHUẨN BỊ TRƯỚC QUAY

```
✅ npm run dev (running)
✅ MongoDB connected (verified)
✅ F12 console ready to ZOOM
✅ Split screen setup (50%-50%)
✅ Test accounts logged out (ready to login)
✅ Microphone tested
✅ Recording software tested (OBS/Camtasia)
✅ Network stable (for Pusher/FCM)
```

---

**Chúc buổi demo thành công! 🎬🩸**

---

## 🔧 TROUBLESHOOTING NHANH

Nếu demo bị lỗi:

```
1. FCM notification không bật lên?
   → Kiểm tra .env có FCM_PROJECT_ID
   → Kiểm trace logs, nếu error thì thử refresh mobile

2. Console logs không hiện?
   → Kiểm tra backend logs bằng `npm run dev`
   → Hoặc check MongoDB atlas logs

3. Hospital không thấy donor response?
   → Refresh page
   → Check Pusher connection: F12 → Network
   → Xem có "pusher" requests không

4. Split screen không ổn?
   → Dùng OBS thay browser split
   → Hoặc dùng 2 monitor
```
