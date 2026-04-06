"use client"
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export const useRequestStatus = () => {
  const { data: session, status: sessionStatus } = useSession();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Wait for session to load
    if (sessionStatus === 'loading' || !session || session.user?.role !== 'user') return;

    const fetchPendingRequests = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/requests?status=pending', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          console.warn(`[useRequestStatus] API returned ${response.status}`);
          setPendingRequests(0);
          return;
        }

        try {
          const data = await response.json();
          setPendingRequests(data.requests?.length || 0);
        } catch (parseError) {
          console.error('[useRequestStatus] Failed to parse JSON response:', parseError);
          setPendingRequests(0);
        }
      } catch (error) {
        console.error('[useRequestStatus] Fetch error:', error);
        setPendingRequests(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingRequests();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingRequests, 30000);
    
    return () => clearInterval(interval);
  }, [session, sessionStatus]);

  return { pendingRequests, loading };
};
