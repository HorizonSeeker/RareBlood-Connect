'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Users, AlertTriangle, Loader } from 'lucide-react';

// Dynamically import Leaflet to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
);

/**
 * HospitalAutoRoutingMap Component
 * 
 * Displays a map showing:
 * - Hospital location (center, red marker)
 * - Donor responders who accepted the emergency request (green markers)
 * - Routes/distance information
 */
export const HospitalAutoRoutingMap = ({ hospitalRequest }) => {
  const [isClient, setIsClient] = useState(false);
  const [L, setL] = useState(null);

  // Load map styling and custom icons
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default);
      });
    }
  }, []);

  if (!hospitalRequest?.hospital_location) {
    return (
      <div className="flex items-center justify-center h-96 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
          <p className="text-[var(--text-secondary)]">Hospital location not available</p>
        </div>
      </div>
    );
  }

  const { latitude, longitude, address } = hospitalRequest.hospital_location;
  const responders = hospitalRequest.responders || [];

  // Check if coordinates are valid
  if (!latitude || !longitude || latitude === 0 || longitude === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-[var(--text-secondary)]">Invalid location coordinates</p>
        </div>
      </div>
    );
  }

  if (!isClient || !L) {
    return (
      <div className="flex items-center justify-center h-96 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
        <div className="text-center">
          <Loader className="h-12 w-12 text-blue-500 mx-auto mb-2" />
          <p className="text-[var(--text-secondary)]">Loading map...</p>
        </div>
      </div>
    );
  }

  // Create custom icons
  const hospitalIcon = L.icon({
    iconUrl: '/icons/hospital-marker.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
    shadowUrl: '/icons/marker-shadow.png',
    shadowSize: [41, 41],
  });

  const donorIcon = L.icon({
    iconUrl: '/icons/donor-marker.png',
    iconSize: [35, 35],
    iconAnchor: [17.5, 35],
    popupAnchor: [0, -35],
    shadowUrl: '/icons/marker-shadow.png',
    shadowSize: [41, 41],
  });

  // Default to hospital location
  const center = [parseFloat(latitude), parseFloat(longitude)];

  return (
    <div className="space-y-4">
      {/* Map Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-5 w-5 text-red-600" />
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">Hospital</p>
          </div>
          <p className="text-xs text-red-700 dark:text-red-300">{address || 'Location set'}</p>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-300 dark:border-green-700">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-900 dark:text-green-200">
              {responders.length} Responders
            </p>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300">
            {responders.length === 0 ? 'Waiting for responses' : 'Donors have accepted'}
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="h-96 rounded-lg overflow-hidden border border-[var(--border-color)] shadow-lg">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          className="z-10"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Hospital Marker */}
          <Marker position={center} icon={hospitalIcon}>
            <Popup className="z-50">
              <div className="p-2">
                <h4 className="font-semibold text-red-700 mb-1">🏥 Hospital</h4>
                <p className="text-sm text-gray-600">{address}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Lat: {latitude}, Lon: {longitude}
                </p>
              </div>
            </Popup>
          </Marker>

          {/* Donor Responder Markers */}
          {responders.map((responder, idx) => (
            <Marker
              key={responder.donorId || idx}
              position={[
                responder.latitude || 0,
                responder.longitude || 0
              ]}
              icon={donorIcon}
            >
              <Popup className="z-50">
                <div className="p-2">
                  <h4 className="font-semibold text-green-700 mb-1">✅ Responder</h4>
                  <p className="text-sm text-gray-600">Donor ID: {responder.donorId}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Responded: {responder.respondedAt ? new Date(responder.respondedAt).toLocaleString('vi-VN') : 'N/A'}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Responders List */}
      {responders.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Donors who accepted ({responders.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {responders.map((responder, idx) => (
              <div
                key={responder.donorId || idx}
                className="p-3 bg-[var(--card-background)] rounded border border-green-300 dark:border-green-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      ✅ Donor accepted
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      ID: {responder.donorId}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {responder.respondedAt 
                      ? new Date(responder.respondedAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalAutoRoutingMap;
