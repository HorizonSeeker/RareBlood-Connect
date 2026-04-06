"use client"

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Heart, MapPin, Navigation, Loader, AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react';

/**
 * 🚨 EMERGENCY SOS REQUEST COMPONENT
 * Features:
 * - Auto-detect user location using navigator.geolocation
 * - Fallback to manual location input if denied
 * - Send SOS broadcast to nearby donors
 * - Create HospitalRequest with auto-routing
 */
export default function EmergencySOSRequest() {
  const { data: session } = useSession();
  const router = useRouter();
  const { success, error } = useToast();

  // 📍 Location state
  const [userLocation, setUserLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    address: '',
    source: 'auto', // 'auto', 'manual', or 'denied'
    loading: false,
    error: null
  });

  // 📋 Form state
  const [formData, setFormData] = useState({
    blood_type: '', // Required
    units_requested: 1, // Required
    urgency_level: 'critical', // critical | high | medium | low
    patient_name: '',
    patient_condition: '',
    reason: '',
    search_radius: 10, // km
    hospital_location_manual: '' // Manual override
  });

  // 📊 Submission state
  const [submitting, setSubmitting] = useState(false);
  const [broadcast_result, setBroadcastResult] = useState(null);

  /**
   * 🔍 Step 1: Auto-detect user location on component mount
   * This is called immediately to start location capture
   */
  useEffect(() => {
    getLocationAuto();
  }, []);

  /**
   * 📍 Get location automatically using navigator.geolocation
   * Tries to get high accuracy position with timeout
   */
  const getLocationAuto = () => {
    setUserLocation(prev => ({ ...prev, loading: true, error: null }));

    // Check if geolocation API available
    if (!('geolocation' in navigator)) {
      console.error('❌ Geolocation not supported');
      setUserLocation(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation not supported by browser',
        source: 'denied'
      }));
      return;
    }

    // Check if HTTPS or localhost
    if (typeof window !== 'undefined' && !window.isSecureContext && !window.location.hostname.includes('localhost')) {
      const errMsg = 'Geolocation requires HTTPS or localhost';
      console.error('❌', errMsg);
      setUserLocation(prev => ({
        ...prev,
        loading: false,
        error: errMsg,
        source: 'denied'
      }));
      return;
    }

    console.log('🔍 Getting user location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(`✅ Location obtained: [${longitude}, ${latitude}]`);

        setUserLocation({
          latitude,
          longitude,
          accuracy,
          address: '', // Will be reverse-geocoded by backend
          source: 'auto',
          loading: false,
          error: null
        });

        success('📍 Location captured successfully');
      },
      (err) => {
        console.error('❌ Geolocation error:', err);
        let errorMsg = 'Unable to get location';

        if (err.code === 1) errorMsg = 'Location permission denied - Use manual input';
        else if (err.code === 2) errorMsg = 'Position unavailable - GPS disabled?';
        else if (err.code === 3) errorMsg = 'Location request timed out';

        setUserLocation(prev => ({
          ...prev,
          loading: false,
          error: errorMsg,
          source: 'denied'
        }));

        error('⚠️ ' + errorMsg);
      },
      {
        enableHighAccuracy: true, // Try to get best accuracy
        timeout: 20000, // 20 seconds
        maximumAge: 0 // Don't use cached position
      }
    );
  };

  /**
   * ✋ Manual location entry (fallback)
   */
  const handleManualLocationInput = (e) => {
    const address = e.target.value;
    setFormData(prev => ({ ...prev, hospital_location_manual: address }));

    // Don't update userLocation here - backend will geocode the address
    if (address.trim()) {
      console.log('📍 Manual location set:', address);
    }
  };

  /**
   * ✅ Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  /**
   * 🚨 HANDLE CREATE REQUEST - Main submission handler
   * Features:
   * - Validates required fields
   * - Includes user location (auto or manual fallback)
   * - Sends to backend for auto-routing
   */
  const handleCreateRequest = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.blood_type) {
      error('❌ Blood type is required');
      return;
    }

    if (formData.units_requested < 1 || formData.units_requested > 50) {
      error('❌ Units must be between 1 and 50');
      return;
    }

    // 🔴 Location validation: Must have either auto-detected or manual location
    if (!userLocation.latitude || !userLocation.longitude) {
      if (!formData.hospital_location_manual || formData.hospital_location_manual.trim() === '') {
        error('❌ Location required: Either allow location access or enter hospital address manually');
        return;
      }
      console.log('⚠️ Using manual location fallback');
    }

    setSubmitting(true);
    try {
      // 📦 Build request payload
      const payload = {
        // ✅ Required for HospitalRequest creation
        request_type: 'patient',
        blood_type: formData.blood_type,
        units_requested: parseInt(formData.units_requested),
        urgency_level: formData.urgency_level,
        is_emergency: true,
        reason: formData.reason || `Emergency SOS request for ${formData.blood_type} blood`,
        search_radius: parseInt(formData.search_radius),

        // 📍 Location data - either auto or manual
        hospital_location: {
          latitude: userLocation.latitude || null,
          longitude: userLocation.longitude || null,
          address: formData.hospital_location_manual || 'User Location'
        },

        // 👥 Patient details
        patient_details: {
          name: formData.patient_name || `${session?.user?.name || 'Patient'}`,
          age: 0, // Not required for emergency
          condition: formData.patient_condition || 'Emergency - Urgent'
        },

        // 📊 Metadata
        user_latitude: userLocation.latitude,
        user_longitude: userLocation.longitude,
        location_accuracy: userLocation.accuracy,
        location_source: userLocation.source
      };

      console.log('📤 Sending emergency SOS request:', JSON.stringify(payload, null, 2));

      // 🚀 Send to backend API
      const response = await fetch('/api/hospital-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken || ''}` // If session exists
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create request');
      }

      // ✅ Success!
      console.log('✅ Emergency SOS broadcasted successfully');
      success('🚨 Emergency SOS Broadcasted! Nearby donors are being notified...');

      // Store result for display
      setBroadcastResult({
        requestId: data.request?._id,
        donorsNotified: data.request?.donors_notified || 0,
        status: data.request?.status,
        geosearch_triggered: data.request?.geosearch_triggered
      });

      // Reset form
      setTimeout(() => {
        setFormData({
          blood_type: '',
          units_requested: 1,
          urgency_level: 'critical',
          patient_name: '',
          patient_condition: '',
          reason: '',
          search_radius: 10,
          hospital_location_manual: ''
        });
        // Redirect after 3 seconds
        setTimeout(() => router.push('/hospital-requests'), 3000);
      }, 1500);

    } catch (err) {
      console.error('❌ Error submitting emergency request:', err);
      error(`❌ Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 🎯 Retry location detection
   */
  const retryLocation = () => {
    getLocationAuto();
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-red-600 text-white p-6 rounded-xl mb-6 shadow-lg">
            <TriangleAlert className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-2">🚨 Emergency SOS Request</h1>
            <p className="text-lg opacity-90">Broadcast urgent blood request to nearby donors</p>
          </div>
        </div>

        {/* Success Modal */}
        {broadcast_result && (
          <div className="bg-green-50 dark:bg-green-900 border-2 border-green-500 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-green-800 dark:text-green-100 text-lg mb-2">✅ SOS Broadcasted Successfully!</h3>
                <p className="text-green-700 dark:text-green-200 mb-1">Request ID: {broadcast_result.requestId}</p>
                <p className="text-green-700 dark:text-green-200 mb-1">Donors Notified: {broadcast_result.donorsNotified}</p>
                <p className="text-green-700 dark:text-green-200">Status: {broadcast_result.status}</p>
              </div>
            </div>
          </div>
        )}

        {/* Location Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6 shadow-md border border-gray-200 dark:border-slate-600">
          <div className="flex items-center mb-4">
            <MapPin className="h-6 w-6 text-red-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Location</h2>
          </div>

          {/* Auto Location Status */}
          <div className="mb-4">
            {userLocation.loading ? (
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                <Loader className="h-5 w-5 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-200">Getting your location...</span>
              </div>
            ) : userLocation.latitude ? (
              <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg border border-green-200 dark:border-green-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-100">✅ Location Detected</p>
                    <p className="text-sm text-green-700 dark:text-green-200">
                      Lat: {userLocation.latitude.toFixed(6)}, Lon: {userLocation.longitude.toFixed(6)}
                    </p>
                    {userLocation.accuracy && (
                      <p className="text-sm text-green-600 dark:text-green-300">Accuracy: ±{userLocation.accuracy.toFixed(0)}m</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-100">⚠️ Location Not Available</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-200 mb-3">{userLocation.error}</p>
                    <button
                      onClick={retryLocation}
                      className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded transition"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Location Fallback */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Hospital Address (Fallback)
            </label>
            <input
              type="text"
              placeholder="e.g., City Hospital, Dhaka or Full address with postal code"
              value={formData.hospital_location_manual}
              onChange={handleManualLocationInput}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ℹ️ If auto-location fails, enter hospital name or address. Backend will geocode it.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateRequest} className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-slate-600">
          {/* Blood Type */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Blood Type *
            </label>
            <select
              name="blood_type"
              value={formData.blood_type}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Select Blood Type</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Units Required */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Units Required *
              </label>
              <input
                type="number"
                name="units_requested"
                value={formData.units_requested}
                onChange={handleInputChange}
                min="1"
                max="50"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Urgency Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Urgency Level
              </label>
              <select
                name="urgency_level"
                value={formData.urgency_level}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          {/* Patient Details */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Patient Name
            </label>
            <input
              type="text"
              name="patient_name"
              value={formData.patient_name}
              onChange={handleInputChange}
              placeholder="Patient's name"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Patient Condition */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Patient Condition
            </label>
            <input
              type="text"
              name="patient_condition"
              value={formData.patient_condition}
              onChange={handleInputChange}
              placeholder="e.g., Severe bleeding, Post-surgery, Critical"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Reason for Request
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Briefly explain why blood is needed urgently..."
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Search Radius */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Search Radius (km)
            </label>
            <select
              name="search_radius"
              value={formData.search_radius}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="20">20 km</option>
              <option value="50">50 km</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader className="h-5 w-5" />
                Broadcasting SOS...
              </>
            ) : (
              <>
                <Heart className="h-5 w-5" />
                🚨 Broadcast Emergency SOS
              </>
            )}
          </button>
        </form>

        {/* Information Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-500 p-4 rounded text-sm text-blue-800 dark:text-blue-200">
          <p className="font-semibold mb-2">ℹ️ How Emergency SOS Works:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your location is used to find nearby donors</li>
            <li>Backend geocodes manual address if auto-location fails</li>
            <li>System searches for matching blood type within search radius</li>
            <li>FCM notifications sent to available donors</li>
            <li>Donors notified immediately with request details</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
