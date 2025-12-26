importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 👇 ĐÃ ĐIỀN THÔNG SỐ CHUẨN CỦA BẠN VÀO ĐÂY
firebase.initializeApp({
  apiKey: "AIzaSyBGuc_UB7D0wEmOJ9KrOYt64nXdJpG5j1s",
  authDomain: "bloodbond-12e9c.firebaseapp.com",
  projectId: "bloodbond-12e9c",
  storageBucket: "bloodbond-12e9c.firebasestorage.app",
  messagingSenderId: "175839093298",
  appId: "1:175839093298:web:0bc9c17ffd783a653c122b"
});

const messaging = firebase.messaging();

// Xử lý tin nhắn khi tắt web (Background)
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Nhận tin nhắn background:', payload);

  // WARNING: If the incoming payload already contains a `notification` field, the browser
  // will automatically display the notification for you. Calling `showNotification` in
  // that case will cause duplicate notifications (one from the browser + one from SW).
  // To avoid duplicates we skip explicit showNotification when payload.notification exists.
  if (payload.notification) {
    console.log('[SW] Payload contains `notification` field — skipping explicit showNotification to avoid duplicates.');
    return;
  }

  // Custom data-only message handling: build and show notification manually
  const notificationTitle = payload.data?.myTitle || 'BloodBond TB Khẩn cấp';
  const notificationOptions = {
    body: payload.data?.myBody || 'Có yêu cầu hiến máu mới',
    icon: '/logo192.png', // Đảm bảo bạn có file logo này trong folder public
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Xử lý khi bấm vào thông báo
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Mở link được gửi kèm trong thông báo, hoặc về trang chủ
  const url = event.notification?.data?.url || '/'; 
  event.waitUntil(clients.openWindow(url));
});