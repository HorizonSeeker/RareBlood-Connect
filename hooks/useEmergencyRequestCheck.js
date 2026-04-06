import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export const useEmergencyRequestCheck = () => {
  const { data: session, status: sessionStatus } = useSession();
  const [hasEmergencyRequest, setHasEmergencyRequest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkEmergencyRequests = async () => {
      // Wait for session to load
      if (sessionStatus === 'loading') {
        return;
      }

      if (!session?.user?.email) {
        setLoading(false);
        setHasEmergencyRequest(false);
        return;
      }

      try {
        // Check if user has made any emergency requests
        const response = await fetch(
          `/api/requests/track?email=${encodeURIComponent(session.user.email)}&checkEmergency=true`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            credentials: 'include',
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          console.warn(`[useEmergencyRequestCheck] API returned ${response.status}`);
          setHasEmergencyRequest(false);
          return;
        }

        try {
          const data = await response.json();
          // Check if any of the requests are emergency requests
          const hasEmergency = data.requests && data.requests.some(req => req.request_type === 'emergency');
          setHasEmergencyRequest(hasEmergency);
        } catch (parseError) {
          console.error('[useEmergencyRequestCheck] Failed to parse JSON response:', parseError);
          setHasEmergencyRequest(false);
        }
      } catch (error) {
        console.error('[useEmergencyRequestCheck] Fetch error:', error);
        setHasEmergencyRequest(false);
      } finally {
        setLoading(false);
      }
    };

    checkEmergencyRequests();
  }, [session?.user?.email, sessionStatus]);

  return { hasEmergencyRequest, loading };
};
