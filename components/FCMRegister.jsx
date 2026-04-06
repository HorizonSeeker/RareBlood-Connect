"use client";
import { useState, useEffect, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { useSession } from 'next-auth/react';
import { messaging } from '@/lib/firebaseClient';

const FCMRegister = () => {
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const tokenRegistered = useRef(false);  // ✅ Track if already registered
  
  const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-register FCM token when user logs in (only once per session)
  useEffect(() => {
    if (isMounted && session?.user && !tokenRegistered.current) {
      tokenRegistered.current = true;  // ✅ Mark as registered immediately
      registerFCMToken();
    }
  }, [session?.user, isMounted]);  // ✅ Removed isRegistering from dependency

  const registerFCMToken = async () => {
    if (isRegistering) return;
    
    try {
      setIsRegistering(true);
      
      console.log('🔵 Starting FCM registration...');
      console.log('🔵 User ID:', session?.user?.id);
      
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('🔵 Notification permission:', permission);
      
      if (permission !== 'granted') {
        console.log('📢 Notification permission not granted');
        setIsRegistering(false);
        return;
      }

      // Register service worker - try both Firebase and default SW
      let reg = null;
      if ('serviceWorker' in navigator) {
        try {
          console.log('🔵 Registering Firebase messaging service worker...');
          reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          console.log('✅ Firebase Service Worker registered:', reg.scope);
        } catch (err) {
          console.error('⚠️ Firebase Service Worker registration failed, trying default SW:', err);
          try {
            // Fallback to default service worker
            reg = await navigator.serviceWorker.ready;
            console.log('✅ Default Service Worker active:', reg.scope);
          } catch (fallbackErr) {
            console.error('❌ No Service Worker available:', fallbackErr);
            setIsRegistering(false);
            return;
          }
        }
      }

      if (!messaging) {
        console.error('❌ Messaging not initialized');
        setIsRegistering(false);
        return;
      }

      if (!VAPID_KEY) {
        console.error('❌ FCM VAPID key not configured');
        setIsRegistering(false);
        return;
      }

      console.log('🔵 Getting FCM token...');
      // Get FCM token
      const token = await getToken(messaging, { 
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: reg
      });

      if (token) {
        console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
        console.log('🔵 Saving token to database...');
        
        // Save token to database
        const response = await fetch('/api/donors/save-fcm-token', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, fcmToken: token })
        });

        if (response.ok) {
          console.log('✅ FCM Token saved to database successfully');
        } else {
          const errorData = await response.json();
          console.error('❌ Failed to save FCM token:', errorData);
        }
      } else {
        console.error('❌ Failed to get FCM token');
      }
    } catch (error) {
      console.error('❌ FCM Registration error:', error);
      console.error('❌ Error details:', error.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleNotificationTest = async () => {
    // Removed test notification button - functionality no longer needed
  };


  // This component handles FCM token registration in the background
  // No UI is rendered; only background registration
  return null;
};

export default FCMRegister;