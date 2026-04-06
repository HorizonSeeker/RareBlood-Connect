"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MapPin, Droplet, Clock, AlertCircle, CheckCircle, XCircle, Navigation, Loader } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

const EmergencyResponsePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { success, error: showError } = useToast();
  
  const requestId = searchParams.get('requestId');
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [actionTaken, setActionTaken] = useState(null); // 'confirmed', 'declined', or null

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      showError("Please log in first");
      router.push("/login");
    }
  }, [status, router, showError]);

  // Get current user location
  useEffect(() => {
    if (navigator.geolocation && !userLocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setUserLocation(loc);
        },
        (error) => {
          console.warn("Could not get user location:", error);
          setUserLocation(null);
        }
      );
    }
  }, [userLocation]);

  // Calculate distance using Haversine formula
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  }, []);

  // Fetch request details
  useEffect(() => {
    const fetchRequest = async () => {
      if (!requestId || status !== "authenticated") return;

      try {
        setLoading(true);
        console.log(`📍 Fetching hospital request: ${requestId}`);
        
        const response = await fetch(`/api/hospital-requests/${requestId}`, {
          credentials: 'include'
        });

        console.log(`📍 Response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          const requestData = data.request || data;
          
          console.log(`📍 Request data:`, requestData);
          setRequest(requestData);

          // Calculate distance if we have location
          // Hospital location can be in request.hospital_id.location or request.hospital_location
          const hospitalLocation = requestData.hospital_id?.location || requestData.hospital_location;
          
          if (userLocation && hospitalLocation) {
            const dist = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              hospitalLocation.latitude || hospitalLocation.coordinates?.[1],
              hospitalLocation.longitude || hospitalLocation.coordinates?.[0]
            );
            setDistance(dist);
            console.log(`📍 Calculated distance: ${dist}km`);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData?.error || `Request failed with status ${response.status}`;
          console.error(`❌ API Error:`, errorMsg);
          showError(errorMsg);
        }
      } catch (error) {
        console.error("❌ Error fetching request:", error);
        showError(`Error loading request: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [requestId, status, userLocation, calculateDistance, showError]);

  // Handle confirm response
  const handleConfirm = async () => {
    if (!requestId) return;

    try {
      setResponding(true);
      console.log(`📞 Sending confirm action for request: ${requestId}`);
      
      const response = await fetch(`/api/hospital-requests/${requestId}/respond-sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'confirm',
          donor_location: userLocation
        })
      });

      console.log(`📞 Response status: ${response.status}`);

      let data = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error("❌ Failed to parse response JSON:", parseErr);
        data = { error: 'Invalid response from server' };
      }

      if (response.ok) {
        success(`✅ Thank you! We have confirmed you will arrive at ${data.hospital_name}`);
        setActionTaken('confirmed');
        
        // Show Google Maps option
        setTimeout(() => {
          if (request?.hospital_location || request?.hospital_id?.location) {
            openGoogleMaps();
          }
        }, 1000);
      } else {
        const errorMsg = data.error || data.details || "Could not confirm response";
        console.error(`❌ Confirm failed:`, errorMsg);
        showError(errorMsg);
      }
    } catch (error) {
      console.error("❌ Error confirming response:", error);
      showError(`Error sending response: ${error?.message || 'Unknown error'}`);
    } finally {
      setResponding(false);
    }
  };

  // Handle decline response
  const handleDecline = async () => {
    if (!requestId) return;

    try {
      setResponding(true);
      console.log(`❌ Sending decline action for request: ${requestId}`);
      
      const response = await fetch(`/api/hospital-requests/${requestId}/respond-sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'decline'
        })
      });

      console.log(`❌ Response status: ${response.status}`);

      let data = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error("❌ Failed to parse response JSON:", parseErr);
        data = { error: 'Invalid response from server' };
      }

      if (response.ok) {
        success("Request has been closed");
        setActionTaken('declined');
        setTimeout(() => router.push('/dashboard/donor'), 2000);
      } else {
        const errorMsg = data.error || data.details || "Could not decline request";
        console.error(`❌ Decline failed:`, errorMsg);
        showError(errorMsg);
      }
    } catch (error) {
      console.error("❌ Error declining response:", error);
      showError(`Error declining request: ${error?.message || 'Unknown error'}`);
    } finally {
      setResponding(false);
    }
  };

  // Open Google Maps with directions
  const openGoogleMaps = () => {
    if (!request?.hospital_location || !userLocation) return;

    const origin = `${userLocation.latitude},${userLocation.longitude}`;
    const destination = `${request.hospital_location.latitude},${request.hospital_location.longitude}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}?travelmode=driving`;
    
    window.open(googleMapsUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-700">Loading information...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Request not found</h1>
          <p className="text-gray-600 mb-6">This request may have expired or does not exist.</p>
          <button
            onClick={() => router.push('/dashboard/donor')}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show confirmation/declined screen
  if (actionTaken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          {actionTaken === 'confirmed' ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-green-600 mb-2">Thank you!</h1>
              <p className="text-gray-600 mb-6">
                We have confirmed you will arrive. The driver will confirm your address and phone number again.
              </p>
              {distance && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <p className="text-lg font-semibold text-blue-600">
                    Khoảng cách: {distance} km
                  </p>
                </div>
              )}
              <button
                onClick={openGoogleMaps}
                disabled={!request?.hospital_location}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2 mb-3"
              >
                <Navigation className="w-5 h-5" />
                Open Google Maps
              </button>
              <button
                onClick={() => router.push('/dashboard/donor')}
                className="w-full bg-gray-300 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-400 transition font-semibold"
              >
                Back
              </button>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Request closed</h1>
              <p className="text-gray-600 mb-6">
                Thank you for considering. If there are other requests, we will contact you.
              </p>
              <button
                onClick={() => router.push('/dashboard/donor')}
                className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-semibold"
              >
                Back to Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Urgency color mapping
  const urgencyColors = {
    critical: 'bg-red-600',
    high: 'bg-orange-600',
    medium: 'bg-yellow-600',
    low: 'bg-green-600'
  };

  const urgencyLabels = {
    critical: '🆘 CRITICAL SITUATION',
    high: '⚠️ URGENT',
    medium: '⏱️ TIME-SENSITIVE',
    low: 'ℹ️ ROUTINE'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Urgency Banner */}
        <div className={`${urgencyColors[request.urgency_level] || 'bg-red-600'} text-white rounded-lg p-4 mb-6 shadow-lg`}>
          <h1 className="text-3xl font-bold text-center">
            {urgencyLabels[request.urgency_level] || '🆘 URGENT'}
          </h1>
          <p className="text-center mt-2 opacity-90">
            Request from {request.hospital_id?.name || 'Hospital'}
          </p>
        </div>

        {/* Main Info Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden mb-6">
          {/* Blood Type & Units */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
            <div className="flex items-center gap-4">
              <Droplet className="w-12 h-12" />
              <div>
                <p className="text-sm opacity-90">Blood type needed</p>
                <h2 className="text-4xl font-bold">{request.blood_type}</h2>
                <p className="text-lg mt-1">{request.units_requested} units</p>
              </div>
            </div>
          </div>

          {/* Hospital Details */}
          <div className="p-6 border-b">
            <h3 className="text-lg font-bold text-gray-800 mb-4">ℹ️ Hospital Information</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-red-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-semibold text-gray-800">
                    {request.hospital_location?.address || 'Address information'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600">Patient</p>
                  <p className="font-semibold text-gray-800">
                    {request.patient_details?.name || 'Unknown'}, {request.patient_details?.age || '?'} years old
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Condition: {request.patient_details?.condition || 'Not determined'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Distance & Time */}
          {distance && (
            <div className="p-6 border-b bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Distance</p>
                  <p className="text-2xl font-bold text-blue-600">{distance} km</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Estimated time</p>
                  <p className="text-2xl font-bold text-blue-600">~{Math.ceil(distance * 2)} minutes</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3">
                💡 Estimate: approximately 2 minutes per 1 km (average traffic)
              </p>
            </div>
          )}

          {/* Responders Count */}
          {request.responders && request.responders.length > 0 && (
            <div className="p-6 border-b bg-green-50">
              <p className="text-sm text-gray-600 mb-2">Confirmed responders</p>
              <p className="text-2xl font-bold text-green-600">{request.responders.length} people</p>
            </div>
          )}

          {/* Request Details */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Request Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Request type</p>
                <p className="font-semibold text-gray-800">
                  {request.request_type === 'patient' ? '👤 Patient' : '🏥 Blood bank'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Priority</p>
                <p className="font-semibold text-gray-800">
                  {urgencyLabels[request.urgency_level] || 'Routine'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created at</p>
                <p className="font-semibold text-gray-800">
                  {new Date(request.created_at).toLocaleString('en-US')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-semibold text-gray-800 uppercase">
                  {request.status === 'auto_routing' ? 'Finding donors' : request.status}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-8">
          <button
            onClick={handleConfirm}
            disabled={responding}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 text-lg flex items-center justify-center gap-2 shadow-lg"
          >
            {responding ? (
              <>
                <Loader className="w-6 h-6" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6" />
                ✅ I will come now
              </>
            )}
          </button>

          <button
            onClick={handleDecline}
            disabled={responding}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 text-lg flex items-center justify-center gap-2 shadow-lg"
          >
            {responding ? (
              <>
                <Loader className="w-6 h-6" />
                Processing...
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6" />
                ❌ I cannot
              </>
            )}
          </button>
        </div>

        {/* Info Text */}
        <div className="bg-yellow-50 border-l-4 border-yellow-600 p-4 rounded">
          <p className="text-sm text-gray-700">
            <strong>⚠️ Note:</strong> When you confirm, the hospital will contact you for further confirmation. 
            Please be ready.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmergencyResponsePage;
