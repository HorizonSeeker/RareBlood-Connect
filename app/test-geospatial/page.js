'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function TestGeospatialPage() {
  const { data: session } = useSession();
  const [latitude, setLatitude] = useState('10.7769');
  const [longitude, setLongitude] = useState('106.6966');
  const [radius, setRadius] = useState('10');
  const [bloodType, setBloodType] = useState('');
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get current location from browser GPS
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setError('');
        setLoading(false);
      },
      (err) => {
        setError(`Error getting location: ${err.message}`);
        setLoading(false);
      }
    );
  };

  // Search for nearby donors
  const searchDonors = async () => {
    if (!latitude || !longitude) {
      setError('Please enter latitude and longitude');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        latitude,
        longitude,
        radius,
        ...(bloodType && { blood_type: bloodType })
      });

      const response = await fetch(`/api/donors/find-nearby?${params}`);
      const data = await response.json();

      if (response.ok) {
        setDonors(data.donors || []);
        if (data.donors.length === 0) {
          setError('No donors found in this radius');
        }
      } else {
        setError(data.error || 'Failed to search donors');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">🩸 Test Geospatial Donor Search</h1>

        {!session && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-6">
            ⚠️ You must be logged in to test donor search
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Search Parameters</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="10.7769"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="106.6966"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Radius (km)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blood Type (optional)</label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={getCurrentLocation}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              📍 Get Current Location
            </button>
            <button
              onClick={searchDonors}
              disabled={loading}
              className="flex-1 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              {loading ? '🔍 Searching...' : '🔍 Search Donors'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded mb-6">
            ❌ {error}
          </div>
        )}

        {donors.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              📍 Found {donors.length} Donor{donors.length !== 1 ? 's' : ''} Within {radius}km
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {donors.map((donor, idx) => (
                <div key={donor._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-semibold text-lg">#{idx + 1}</div>
                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {donor.blood_type}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>Distance:</strong>{' '}
                      <span className="text-blue-600 font-semibold">{donor.distance_km} km</span>
                    </p>
                    <p>
                      <strong>Location:</strong> [{donor.location.coordinates[1].toFixed(4)},{' '}
                      {donor.location.coordinates[0].toFixed(4)}]
                    </p>
                    <p>
                      <strong>Total Donations:</strong> {donor.total_donations}
                    </p>
                    <p>
                      <strong>Accepted Requests:</strong> {donor.accepted_requests}
                    </p>
                    <p>
                      <strong>Status:</strong>{' '}
                      {donor.is_critical_ready ? (
                        <span className="text-green-600 font-semibold">✅ Ready for Critical</span>
                      ) : (
                        <span className="text-gray-500">Not ready</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {donors.length === 0 && !error && !loading && (
          <div className="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-6 rounded text-center">
            Click "Search Donors" to find donors nearby
          </div>
        )}
      </div>
    </div>
  );
}
