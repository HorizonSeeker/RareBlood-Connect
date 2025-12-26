"use client";
import { useState, useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { useSession } from 'next-auth/react';
import { messaging } from '@/lib/firebaseClient';

const FCMRegister = () => {
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false); // To fix Hydration Error
  
  // VAPID key read from environment (NEXT_PUBLIC_FCM_VAPID_KEY)
  const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

  useEffect(() => {
    // This runs only on the client-side, preventing server mismatch
    setIsMounted(true);
  }, []);

  const handleNotificationTest = async () => {
    alert("Processing..."); 

    try {
      // 1. Request Permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        alert("✅ Permission granted! Fetching Token...");
        
        // 2. Register Service Worker manually (Safety check)
        let reg = null;
        if ('serviceWorker' in navigator) {
             try {
                reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log("Service Worker registered successfully");
             } catch (err) {
                console.error("Service Worker Error:", err);
             }
        }

        if (!messaging) {
            alert("Error: Messaging not initialized!");
            return;
        }

        if (!VAPID_KEY) {
          alert("FCM VAPID key is not configured. Set NEXT_PUBLIC_FCM_VAPID_KEY in .env.local");
          return;
        }

        // 3. Get Token
        const token = await getToken(messaging, { 
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg
        });

        if (token) {
          // Show token for copying
          prompt("🎉 COPY THIS TOKEN AND SEND TO PC:", token);
          
          // Save to Database if logged in
          if (session?.user) {
             await fetch('/api/donors/save-fcm-token', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session.user.id, fcmToken: token })
             });
             alert("✅ Token saved to Database!");
          }
        } else {
          alert("⚠️ Error: Token is empty!");
        }
      } else {
        alert("🚫 Permission denied! Please enable notifications in Chrome Settings.");
      }
    } catch (e) {
      alert("❌ Code Error: " + e.message);
      console.error(e);
    }
  };

  // IMPORTANT: Do not render anything until mounted on client
  if (!isMounted) return null;

  return (
    <button 
      onClick={handleNotificationTest}
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        zIndex: 99999,
        padding: '15px 25px',
        backgroundColor: '#007bff', // Blue color
        color: 'white',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: 'bold',
        border: '2px solid white',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
      }}
    >
      TEST NOTIFICATION 🔔
    </button>
  );
};

export default FCMRegister;