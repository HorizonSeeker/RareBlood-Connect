// lib/firebaseClient.js
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// 1. Khởi tạo Firebase App (An toàn cho cả Server và Client)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 2. Khởi tạo Messaging (CHỈ CHẠY TRÊN CLIENT)
// Dùng biến messaging = null mặc định để Server không bị lỗi
let messaging = null;

if (typeof window !== "undefined") {
  // Chỉ khi nào code chạy trên trình duyệt (có window) thì mới gọi getMessaging
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Lỗi khởi tạo Messaging trên Client:", error);
  }
}

// 3. Hàm xin Token (Đã thêm log kiểm tra)
export const requestForToken = async () => {
  // Nếu đang ở Server hoặc lỗi -> Dừng ngay
  if (!messaging) {
    console.log("Messaging chưa sẵn sàng (hoặc đang chạy trên Server).");
    return null;
  }

  try {
    console.log('🔥 Đang xin Token...');
    const currentToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY
    });

    if (currentToken) {
      console.log('✅ FCM Token:', currentToken);
      return currentToken;
    } else {
      console.log('❌ Không lấy được Token.');
      return null;
    }
  } catch (err) {
    console.log('❌ Lỗi khi lấy token:', err);
    return null;
  }
};

export { app, messaging };