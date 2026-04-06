'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import '@/lib/leafletConfig';

// Dynamically import react-leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-gray-200 rounded-lg flex items-center justify-center">Loading map...</div>
});

const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), {
  ssr: false
});

const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), {
  ssr: false
});

const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), {
  ssr: false
});

const MapUpdater = dynamic(() => import('./MapUpdater'), {
  ssr: false
});

const Map = ({ donors = [], center = [10.762622, 106.660172], zoom = 13 }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Ensure this only runs on client
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-[400px] bg-gray-200 rounded-lg flex items-center justify-center text-gray-600">
        Loading map...
      </div>
    );
  }

  // Safely render map only after client-side mount
  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden shadow-lg border border-gray-200">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater donors={donors} />

        {donors && Array.isArray(donors) && donors.map((donor, index) => {
          const coords = donor.coordinates || donor.current_location?.coordinates;

          if (coords && Array.isArray(coords) && coords.length === 2) {
            const [lng, lat] = coords;

            return (
              <Marker key={donor._id || index} position={[lat, lng]}>
                <Popup>
                  <div className="text-sm font-sans">
                    <h3 className="font-bold text-gray-900">{donor.name || 'Donor'}</h3>
                    <p className="text-gray-700">Blood type: <span className="font-semibold">{donor.blood_type || 'N/A'}</span></p>
                    <p className="text-gray-700">Phone: {donor.mobile_number || donor.phone || 'N/A'}</p>
                    {donor.distance_km && <p className="text-gray-600 text-xs">Distance: {donor.distance_km.toFixed(2)} km</p>}
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default Map;
