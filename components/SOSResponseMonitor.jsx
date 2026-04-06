"use client";
import React, { useState, useEffect } from 'react';
import Pusher from 'pusher-js';
import { Users, AlertCircle, Phone, Droplet } from 'lucide-react';

/**
 * Component: SOS Response Monitor
 * 
 * Displays real-time SOS responders as they confirm.
 * Used in blood bank dashboard to track donors responding to emergency broadcast.
 * 
 * Props:
 * - requestId: Hospital request ID
 * - bloodbankId: Blood bank ID (for Pusher channel)
 * - initialResponders: Initial responders array (optional)
 * - onUpdateResponders: Callback when responders update (optional)
 */
const SOSResponseMonitor = ({ 
  requestId, 
  bloodbankId, 
  initialResponders = [], 
  onUpdateResponders 
}) => {
  const [responders, setResponders] = useState(initialResponders);
  const [isLive, setIsLive] = useState(false);
  const [latestResponder, setLatestResponder] = useState(null);

  useEffect(() => {
    if (!bloodbankId || !requestId) {
      console.warn('[SOSMonitor] Missing bloodbankId or requestId');
      return;
    }

    // Initialize Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      encrypted: true
    });

    const channelName = `bloodbank-${bloodbankId}`;
    const channel = pusher.subscribe(channelName);

    console.log(`[SOSMonitor] Subscribing to ${channelName} for updates on request ${requestId}`);
    setIsLive(true);

    // Listen for SOS response updates
    channel.bind('sos-response-update', (data) => {
      if (data.request_id !== requestId) return;

      console.log('[SOSMonitor] 📱 New SOS response received:', data);

      // Update responders list
      setResponders(prev => {
        const isDuplicate = prev.some(r => r.name === data.donor_name);
        if (isDuplicate) return prev;
        return [...prev, {
          name: data.donor_name,
          phone: data.donor_phone,
          blood_type: data.blood_type,
          respondedAt: data.timestamp,
          distance_km: data.donor_distance_km
        }];
      });

      // Show latest responder notification
      setLatestResponder({
        name: data.donor_name,
        blood_type: data.blood_type,
        distance: data.donor_distance_km,
        respondedAt: Date.now()
      });

      // Trigger callback
      if (onUpdateResponders) {
        onUpdateResponders(data);
      }

      // Clear latest responder notification after 5 seconds
      setTimeout(() => setLatestResponder(null), 5000);
    });

    // Cleanup
    return () => {
      channel.unbind('sos-response-update');
      pusher.unsubscribe(channelName);
    };
  }, [bloodbankId, requestId, onUpdateResponders]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-red-600" />
          <h2 className="text-2xl font-bold text-gray-800">
            🆘 SOS Responders
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm font-semibold text-gray-700">
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Latest Responder Notification (Toast-like) */}
      {latestResponder && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-green-700">✨ {latestResponder.name} is donating blood!</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <Droplet className="w-4 h-4" />
                  {latestResponder.blood_type}
                </div>
                {latestResponder.distance && (
                  <div className="text-sm text-green-600">
                    📍 {latestResponder.distance} km
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responders Count Badge */}
      <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
        <p className="text-sm text-gray-600">Total confirmed</p>
        <p className="text-4xl font-bold text-red-600">{responders.length}</p>
      </div>

      {/* Responders List */}
      {responders.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Responder details
          </p>
          {responders.map((responder, idx) => (
            <div 
              key={idx}
              className="p-4 border rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {responder.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800 truncate">
                      {responder.name}
                    </p>
                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                      🩸 {responder.blood_type}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {responder.phone || 'N/A'}
                    </div>
                    {responder.distance_km && (
                      <div className="text-blue-600 font-semibold">
                        📍 {responder.distance_km} km
                      </div>
                    )}
                  </div>

                  {responder.respondedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Confirmed at: {new Date(responder.respondedAt).toLocaleTimeString('en-US')}
                    </p>
                  )}
                </div>

                {/* Call Button */}
                <a 
                  href={`tel:${responder.phone}`}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded transition flex-shrink-0"
                >
                  Call
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-gray-500">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>No one has confirmed yet</p>
          <p className="text-sm text-gray-400">
            Donors will appear here when they confirm
          </p>
        </div>
      )}

      {/* Stats Footer */}
      {responders.length > 0 && (
        <div className="mt-6 pt-6 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-600">{responders.length}</p>
            <p className="text-xs text-gray-600">🩸 Matching blood types</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {responders.reduce((min, r) => {
                if (!r.distance_km) return min;
                const dist = parseFloat(r.distance_km);
                return min === null ? dist : Math.min(min, dist);
              }, null)?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-xs text-gray-600">📍 Closest (km)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {responders.filter(r => r.distance_km && parseFloat(r.distance_km) < 5).length}
            </p>
            <p className="text-xs text-gray-600">🚗 Within 5 km</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SOSResponseMonitor;
