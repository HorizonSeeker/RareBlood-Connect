"use client"
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/context/ToastContext';

export const useEmergencyNotifications = () => {
  const { data: session, status } = useSession();
  const { warning } = useToast();
  const [lastNotificationTime, setLastNotificationTime] = useState(null);

  useEffect(() => {
    // Wait for session to load - skip if session is still loading or user is not logged in
    if (status === 'loading' || !session?.user || session.user.role !== 'bloodbank_admin') {
      return;
    }

    const checkForNewEmergencyRequests = async () => {
      try {
        console.log('[Emergency Notifications] 🔍 Checking for new emergency requests...');
        
        const response = await fetch('/api/requests?request_type=emergency&status=pending', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
          cache: 'no-store',
        });

        // Handle non-OK responses
        if (!response.ok) {
          console.warn(`[Emergency Notifications] ⚠️ API returned ${response.status}: ${response.statusText}`);
          
          // Only log detailed errors for unexpected status codes
          if (response.status !== 401 && response.status !== 403) {
            try {
              const errorData = await response.json();
              console.error('[Emergency Notifications] Error response:', errorData);
            } catch (e) {
              console.warn('[Emergency Notifications] Could not parse error response:', e.message);
            }
          }
          return;
        }

        // Parse response safely
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('[Emergency Notifications] ❌ Failed to parse JSON response:', parseError.message);
          return;
        }

        const emergencyRequests = data.requests || [];
        console.log(`[Emergency Notifications] ✅ Found ${emergencyRequests.length} emergency requests`);
        
        // Check for new emergency requests
        emergencyRequests.forEach(request => {
          try {
            const requestTime = new Date(request.requested_date).getTime();
            
            // Only notify for requests made in the last 30 seconds and after last notification
            const now = Date.now();
            const thirtySecondsAgo = now - 30000;
            
            if (requestTime > thirtySecondsAgo && 
                (!lastNotificationTime || requestTime > lastNotificationTime)) {
              
              const requesterName = request.requested_by_user?.name || 
                                   request.emergency_requester_name || 
                                   'Someone';
              
              warning(
                `🚨 EMERGENCY: ${requesterName} needs ${request.units_required} units of ${request.blood_type} blood!`,
                10000 // Show for 10 seconds
              );
              
              setLastNotificationTime(requestTime);
            }
          } catch (requestError) {
            console.warn('[Emergency Notifications] ⚠️ Error processing request:', requestError?.message || requestError);
          }
        });
      } catch (error) {
        // Network errors or other fetch errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'Unknown';
        
        console.error('[Emergency Notifications] ❌ Fetch error:', {
          message: errorMessage,
          name: errorName,
          hasStack: !!(error instanceof Error && error.stack)
        });
        
        // Only log stack if it's a real Error object
        if (error instanceof Error && error.stack) {
          console.error('[Emergency Notifications] Stack trace:', error.stack);
        }
      }
    };

    // Check immediately on session load
    checkForNewEmergencyRequests();

    // Then check every 15 seconds
    const interval = setInterval(checkForNewEmergencyRequests, 15000);

    return () => clearInterval(interval);
  }, [session, status, warning, lastNotificationTime]);

  return null;
};

export default useEmergencyNotifications;
