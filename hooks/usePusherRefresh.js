import { useEffect } from 'react';
import Pusher from 'pusher-js';

/**
 * Custom Hook to listen to Pusher real-time updates
 * @param {Function} onUpdate - Callback function called when new event arrives (example: fetchData)
 * @param {String} channel - Pusher channel to subscribe to (default: 'blood-channel')
 * @param {String} event - Event to listen for (default: 'new-request')
 */
export const usePusherRefresh = (
  onUpdate,
  channel = 'blood-channel',
  event = 'new-request'
) => {
  useEffect(() => {
    // Check if Pusher key exists
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
      console.warn('⚠️ PUSHER key not set; skipping Pusher subscription');
      return;
    }

    // Check if callback function is valid
    if (typeof onUpdate !== 'function') {
      console.error('❌ usePusherRefresh: onUpdate must be a function');
      return;
    }

    let pusher;
    let pusherChannel;

    try {
      // Khởi tạo Pusher
      pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      });

      // Subscribe kênh
      pusherChannel = pusher.subscribe(channel);

      console.log(`✅ Subscribed to channel: ${channel}, listening for event: ${event}`);

      // Bind event listener
      pusherChannel.bind(event, (data) => {
        console.log(`📨 Event '${event}' received:`, data);
        
        // Gọi callback function để refresh dữ liệu
        try {
          console.log(`⏳ Calling onUpdate callback...`);
          onUpdate(data);
          console.log(`✅ onUpdate callback executed successfully`);
        } catch (err) {
          console.error(`❌ Error in onUpdate callback:`, err);
        }
      });

      // Cleanup when component unmounts
      return () => {
        try {
          pusherChannel.unbind_all();
          pusherChannel.unsubscribe();
          pusher.disconnect();
          console.log(`🔌 Disconnected from channel: ${channel}`);
        } catch (err) {
          console.error('Error during Pusher cleanup:', err);
        }
      };
    } catch (err) {
      console.error('Error setting up Pusher subscription:', err);
    }
  }, [onUpdate, channel, event]);
};

export default usePusherRefresh;
