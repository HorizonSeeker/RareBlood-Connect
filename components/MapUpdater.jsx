'use client';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

const MapUpdater = ({ donors = [] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !donors || donors.length === 0) return;

    try {
      const latlngs = donors
        .map(d => {
          const coords = d.coordinates || d.current_location?.coordinates;
          if (!coords || !Array.isArray(coords) || coords.length !== 2) return null;
          const [lng, lat] = coords;
          return [lat, lng];
        })
        .filter(Boolean);

      if (latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (error) {
      console.error('Error fitting map bounds:', error);
    }
  }, [donors, map]);

  return null;
};

export default MapUpdater;
