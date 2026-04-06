'use client';
import { useEffect } from 'react';
import Pusher from 'pusher-js';
import { useToast } from '@/context/ToastContext';

export default function PusherListener() {
  const { info, success } = useToast();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
      console.warn('PUSHER key not set; skipping Pusher initialization');
      return;
    }

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    });

    const channel = pusher.subscribe('blood-channel');

    channel.bind('new-alert', (data) => {
      const text = data?.message || 'Thông báo mới từ hệ thống';
      // Show a toast instead of alert
      success(`🔔 ${text}`);
    });

    // Listen for donor/hospital responses to contact requests
    channel.bind('request:response', (data) => {
      const text = data?.message || `Request ${data?.requestId} updated: ${data?.status}`;
      success(`🔔 ${text}`);

      try {
        // Emit a client-side event so interested components can refresh
        window.dispatchEvent(new CustomEvent('request:response', { detail: data }));
      } catch (err) {
        // ignore dispatch errors
      }
    });

    return () => {
      try {
        channel.unbind_all();
        channel.unsubscribe();
        pusher.disconnect();
      } catch (err) {
        // ignore cleanup errors
      }
    };
  }, [info, success]);

  return null;
}
