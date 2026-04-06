'use client';
import { Phone } from 'lucide-react';

export default function DonorCard({ donor, idx, onContact }) {
  // Format distance: if < 1 km, show in meters
  const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
      const meters = Math.round(distanceKm * 1000);
      return `${meters}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white">
      {/* Header with blood type and distance */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <span className="inline-block w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
            #{idx}
          </span>
          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex-shrink-0">
            {donor.blood_type}
          </span>
          <span className="text-gray-500 text-sm">📍 {formatDistance(donor.distance_km)}</span>
        </div>
      </div>

      {/* Donor Name */}
      <div className="mb-3">
        <p className="font-semibold text-gray-800">{donor.name || 'Unknown Donor'}</p>
        <p className="text-xs text-gray-500">{donor.email || 'No email'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
        <div className="text-center">
          <p className="text-gray-600 text-xs">Donations</p>
          <p className="font-semibold text-lg">{donor.total_donations || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-xs">Requests</p>
          <p className="font-semibold text-lg">{donor.accepted_requests || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-xs">Status</p>
          <p className={`font-semibold text-xs ${donor.is_critical_ready ? 'text-green-600' : 'text-gray-500'}`}>
            {donor.is_critical_ready ? '✅ Ready' : '⭕ Available'}
          </p>
        </div>
      </div>

      {/* Contact Button */}
      <button
        onClick={() => onContact(donor)}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
      >
        <Phone className="w-4 h-4" />
        Contact Donor
      </button>
    </div>
  );
}
