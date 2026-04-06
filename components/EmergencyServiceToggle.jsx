'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Heart, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { toast } from 'react-toastify';
import { getToken } from 'firebase/messaging';
import { messaging } from '@/lib/firebaseClient';

export default function EmergencyServiceToggle() {
  const { data: session, status } = useSession();
  const [isCriticalReady, setIsCriticalReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);

  // Fetch current emergency service status
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const fetchStatus = async () => {
      try {
        console.log('🔵 Fetching emergency service status...');
        const response = await fetch('/api/donors/emergency-service', {
          method: 'GET',
          credentials: 'include',
        });

        const data = await response.json();
        console.log('🔵 Status response:', data);

        if (response.ok) {
          setIsCriticalReady(data.is_critical_ready || false);
          setVerified(data.can_enable || false);
          console.log('✅ Status loaded:', {
            is_critical_ready: data.is_critical_ready,
            can_enable: data.can_enable
          });
        } else {
          console.log("⚠️ Could not fetch status (may not be verified yet):", data.error);
          setError(data.error);
        }
      } catch (err) {
        console.error('❌ Error fetching status:', err);
        setError('Failed to load emergency service status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [session?.user?.id, status]);

  const handleToggle = async () => {
    if (!verified) {
      toast.error('You must be verified as a donor to enable emergency service');
      return;
    }

    setToggling(true);
    try {
      const isEnabling = !isCriticalReady;
      console.log('🔵 Toggling emergency service to:', isEnabling);

      let fcmToken = null;

      // If enabling, request notification permission and get FCM token
      if (isEnabling) {
        console.log('🔵 Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('🔵 Notification permission:', permission);

        if (permission !== 'granted') {
          toast.error('Notification permission is required for emergency service');
          setToggling(false);
          return;
        }

        // Register service worker and get FCM token
        if ('serviceWorker' in navigator && messaging) {
          try {
            console.log('🔵 Registering Firebase messaging service worker...');
            const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            console.log('✅ Firebase Service Worker registered:', reg.scope);
            
            // Add a small delay to ensure service worker is ready
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log('🔵 Getting FCM token with service worker...');
            const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
            fcmToken = await getToken(messaging, {
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: reg
            });

            if (fcmToken) {
              console.log('✅ FCM Token obtained:', fcmToken.substring(0, 20) + '...');
            } else {
              console.warn('⚠️ Failed to get FCM token');
            }
          } catch (err) {
            console.error('❌ Error registering service worker or getting FCM token:', err);
            toast.warning('Could not obtain notification token, but service will be enabled');
          }
        } else if (messaging) {
          // Fallback: try to get token without explicit service worker registration
          try {
            console.log('🔵 Getting FCM token (service worker not available)...');
            const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
            fcmToken = await getToken(messaging, {
              vapidKey: VAPID_KEY
            });

            if (fcmToken) {
              console.log('✅ FCM Token obtained:', fcmToken.substring(0, 20) + '...');
            } else {
              console.warn('⚠️ Failed to get FCM token');
            }
          } catch (err) {
            console.error('❌ Error getting FCM token:', err);
            toast.warning('Could not obtain notification token, but service will be enabled');
          }
        } else {
          console.warn('⚠️ Firebase messaging not initialized');
          toast.warning('Notification service not available, but Emergency Service will be enabled');
        }
      }

      const response = await fetch('/api/donors/emergency-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          is_critical_ready: isEnabling,
          fcmToken: fcmToken
        }),
      });

      const data = await response.json();
      console.log('🔵 Toggle response:', data);

      if (response.ok) {
        setIsCriticalReady(data.donor.is_critical_ready);
        const message = data.donor.is_critical_ready
          ? '✅ Emergency service activated! You will receive notifications for critical blood requests.'
          : '⏸️ Emergency service deactivated.';
        toast.success(message);
        console.log('✅ Service toggled successfully');
      } else {
        console.error('❌ Toggle failed:', data.error);
        toast.error(data.error || 'Failed to update emergency service');
      }
    } catch (err) {
      console.error('❌ Error toggling service:', err);
      toast.error('Error updating emergency service status');
    } finally {
      setToggling(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="h-20 bg-gray-200 rounded-lg"></div>
    );
  }

  if (!verified && !error) {
    return null; // Don't show if not verified
  }

  return (
    <div className={`p-4 rounded-lg border-2 ${
      isCriticalReady 
        ? 'border-red-300 bg-red-50' 
        : 'border-gray-300 bg-gray-50'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {isCriticalReady ? (
            <CheckCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          ) : (
            <Heart className="w-6 h-6 text-gray-600 flex-shrink-0" />
          )}
          <div>
            <h3 className="font-semibold text-gray-800">
              Emergency Service {isCriticalReady ? 'Active' : 'Inactive'}
            </h3>
            {!verified ? (
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-4 h-4" />
                Complete verification to enable
              </p>
            ) : (
              <p className="text-sm text-gray-600 mt-1">
                {isCriticalReady
                  ? 'You will receive notifications for critical blood requests'
                  : 'Click toggle to activate emergency service'}
              </p>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={handleToggle}
          disabled={toggling || !verified}
          className={`relative w-14 h-8 rounded-full transition-all flex items-center ${
            isCriticalReady 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-gray-300 hover:bg-gray-400'
          } ${toggling || !verified ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {toggling && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader className="w-4 h-4 text-white" />
            </div>
          )}
          <div
            className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${
              isCriticalReady ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
