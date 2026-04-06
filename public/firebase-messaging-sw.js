importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 👇 YOUR STANDARD PARAMETERS ARE FILLED IN BELOW
firebase.initializeApp({
  apiKey: "AIzaSyBGuc_UB7D0wEmOJ9KrOYt64nXdJpG5j1s",
  authDomain: "bloodbond-12e9c.firebaseapp.com",
  projectId: "bloodbond-12e9c",
  storageBucket: "bloodbond-12e9c.firebasestorage.app",
  messagingSenderId: "175839093298",
  appId: "1:175839093298:web:0bc9c17ffd783a653c122b"
});

const messaging = firebase.messaging();

console.log('[Firebase SW] Service Worker initialized for:', self.location.href);

// Handle messages when web is closed (Background) - this is critical for PWA notifications
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] 📬 Received background message:', payload);
  console.log('[SW] Notification:', payload.notification);
  console.log('[SW] Data:', payload.data);

  // WARNING: If the incoming payload already contains a `notification` field, the browser
  // will automatically display the notification for you. Calling `showNotification` in
  // that case will cause duplicate notifications (one from the browser + one from SW).
  // To avoid duplicates we skip explicit showNotification when payload.notification exists.
  if (payload.notification) {
    console.log('[SW] ✅ Payload contains `notification` field — browser will display automatically');
    return;
  }

  // Custom data-only message handling: build and show notification manually
  const notificationTitle = payload.data?.title || 'BloodBond Notification';
  const notificationOptions = {
    body: payload.data?.body || 'You have a new message',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'bloodbond-notification',
    requireInteraction: false,
    data: payload.data || {}
  };

  console.log('[SW] 🔔 Showing notification:', notificationTitle, notificationOptions);
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle when notification is clicked
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] 🖱️ Notification clicked:', event.notification.tag);
  event.notification.close();
  
  // Open the link sent with the notification, or go to home page
  const url = event.notification?.data?.url || '/'; 
  console.log('[SW] 🌐 Opening URL:', url);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Check if there's already a window/tab open with our app
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Keep service worker alive
self.addEventListener('install', function(event) {
  console.log('[SW] 📦 Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] ✅ Service Worker activated');
  event.waitUntil(clients.claim());
});