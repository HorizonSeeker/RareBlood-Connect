'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ProtectedRoute from '@/components/ProtectedRoute';
import QuickContactDonor from '@/components/QuickContactDonor';
import DonorCard from '@/components/DonorCard';
import { MapPin, Search, Droplet } from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy-load Map component
const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">Loading map...</div>
});

export default function FindDonorsPage() {
  const { data: session } = useSession();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('15');
  const [bloodType, setBloodType] = useState('');
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchDone, setSearchDone] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState(null);

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
    setSearchDone(false);

    try {
      // Convert commas to dots in latitude and longitude
      const cleanLatitude = latitude.replace(',', '.');
      const cleanLongitude = longitude.replace(',', '.');
      
      const params = new URLSearchParams({
        latitude: cleanLatitude,
        longitude: cleanLongitude,
        radius,
        ...(bloodType && { blood_type: bloodType })
      });

      const response = await fetch(`/api/donors/find-nearby?${params}`);
      const data = await response.json();

      if (response.ok) {
        setDonors(data.donors || []);
        setSearchDone(true);
        if ((data.donors || []).length === 0) {
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

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchDonors();
    }
  };

  // Prepare donor data for map
  const mapMarkers = donors.map(donor => ({
    _id: donor._id,
    name: donor.name || `${donor.blood_type} Donor`,
    coordinates: donor.location?.coordinates,
    blood_type: donor.blood_type,
    distance_km: donor.distance_km,
    is_critical_ready: donor.is_critical_ready
  }));

  const userCenter = latitude && longitude ? [parseFloat(latitude), parseFloat(longitude)] : null;

  return (
    <ProtectedRoute requiredRoles={['bloodbank_admin']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <MapPin className="w-10 h-10 text-red-600" />
              Find Nearby Donors
            </h1>
            <p className="text-gray-600 mt-2">Search and locate donors within your preferred radius</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5 text-red-600" />
                  Search Criteria
                </h2>

                <div className="space-y-4">
                  {/* Latitude */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="10.7769"
                    />
                  </div>

                  {/* Longitude */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="106.6966"
                    />
                  </div>

                  {/* Radius */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Radius (km)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="15"
                    />
                  </div>

                  {/* Blood Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-red-600" />
                      Blood Type (Optional)
                    </label>
                    <select
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value="">All Types</option>
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

                  {/* Buttons */}
                  <div className="space-y-2 pt-4">
                    <button
                      onClick={getCurrentLocation}
                      disabled={loading}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      {loading ? 'Getting Location...' : 'Get Current Location'}
                    </button>
                    <button
                      onClick={searchDonors}
                      disabled={loading || !latitude || !longitude}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      {loading ? 'Searching...' : 'Search Donors'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              {searchDone && (
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="h-96">
                    <MapWithNoSSR
                      donors={mapMarkers}
                      center={userCenter}
                      zoom={13}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
                  <span className="text-xl">❌</span>
                  {error}
                </div>
              )}

              {/* Results */}
              {searchDone && donors.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    📍 Found {donors.length} Donor{donors.length !== 1 ? 's' : ''} within {radius}km
                  </h3>

                  <div className="overflow-y-auto max-h-[500px] pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {donors.map((donor, idx) => (
                        <DonorCard
                          key={donor._id}
                          donor={donor}
                          idx={idx + 1}
                          onContact={() => setSelectedDonor(donor)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {searchDone && donors.length === 0 && !error && (
                <div className="bg-gray-50 border border-gray-200 text-gray-700 px-6 py-8 rounded-lg text-center">
                  <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="font-medium">No donors found</p>
                  <p className="text-sm text-gray-500 mt-1">Try increasing the search radius or removing blood type filter</p>
                </div>
              )}

              {/* Initial State */}
              {!searchDone && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-8 rounded-lg text-center">
                  <Search className="w-12 h-12 mx-auto text-blue-400 mb-3" />
                  <p className="font-medium">Ready to find donors</p>
                  <p className="text-sm text-blue-600 mt-1">Click "Search Donors" to find available donors in your area</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Donor Modal - Outside main layout to avoid z-index stacking issues */}
      {selectedDonor && (
        <div className="fixed inset-0 z-[9999]">
          <QuickContactDonor 
            donor={selectedDonor} 
            onClose={() => setSelectedDonor(null)} 
          />
        </div>
      )}
    </ProtectedRoute>
  );
}
