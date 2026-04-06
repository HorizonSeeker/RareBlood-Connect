"use client"
import { useToast } from '@/context/ToastContext';
import { formatCompatibilityForDisplay, getCompatibleBloodTypes } from '@/lib/bloodCompatibility';
import { CheckCircle, Clock, Droplet, Heart, Loader, MapPin, Navigation, Phone, TriangleAlert, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

const EmergencyPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, error } = useToast();
  
  // ROLE CHECK: Block Donor (user role), Bloodbank_Admin, and Hospital from accessing emergency form
  React.useEffect(() => {
    if (session && ['user', 'bloodbank_admin', 'hospital'].includes(session.user?.role)) {
      error('⛔ Access Denied! Emergency requests are not available for your account.');
      router.push('/dashboard');
    }
  }, [session, router, error]);

  const [formData, setFormData] = useState({
    patientName: '',
    contactNumber: '',
    bloodType: '',
    compatibleBloodTypes: [],
    unitsRequired: '',
    hospitalLocation: '',
    emergencyDetails: '',
    latitude: null,
    longitude: null,
    // Additional fields for non-logged-in users
    requesterName: '',
    requesterEmail: '',
    relationToPatient: ''
  });
  
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    loading: false,
    error: null,
    debug: null // detailed error info for troubleshooting (dev use)
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState('');
  const [bloodCompatibilityInfo, setBloodCompatibilityInfo] = useState(null);

  // Get user's current location
  const getCurrentLocation = () => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    if (!('geolocation' in navigator)) {
      const errMsg = 'Geolocation is not supported by this browser.';
      console.error(errMsg);
      setLocation(prev => ({ ...prev, loading: false, error: errMsg }));
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext && !window.location.hostname.includes('localhost')) {
      const errMsg = 'Geolocation requires a secure context (HTTPS) or localhost. Access location over HTTPS.';
      console.error(errMsg);
      setLocation(prev => ({ ...prev, loading: false, error: errMsg }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('Geolocation success:', position);
        setLocation({ latitude, longitude, loading: false, error: null });
        setFormData(prev => ({ ...prev, latitude, longitude }));
      },
      (err) => {
        console.error('Geolocation error (raw):', err);
        let msg = 'Unable to retrieve your location.';
        if (err.code === 1) msg = 'Permission denied. Please allow location access.';
        else if (err.code === 2) msg = 'Position unavailable. Ensure GPS is enabled.';
        else if (err.code === 3) msg = 'Location request timed out. Try again.';
        
        setLocation(prev => ({ ...prev, loading: false, error: msg, debug: err }));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Update blood compatibility info when blood type changes
    if (name === 'bloodType' && value) {
      const compatibilityInfo = formatCompatibilityForDisplay(value);
      const compatibleTypes = getCompatibleBloodTypes(value);
      setFormData(prev => ({ ...prev, compatibleBloodTypes: compatibleTypes }));
      setBloodCompatibilityInfo(compatibilityInfo);
    } else if (name === 'bloodType' && !value) {
      setFormData(prev => ({ ...prev, compatibleBloodTypes: [] }));
      setBloodCompatibilityInfo(null);
    }
  };

  // Fetch nearby blood banks and auto-select nearest one
  const fetchNearbyBloodBanks = async (lat, lon) => {
    try {
      const response = await fetch('/api/emergency/nearby-bloodbanks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          bloodType: formData.bloodType
        })
      });

      const data = await response.json();
      if (data.nearby_blood_banks && data.nearby_blood_banks.length > 0) {
        // Auto-select the nearest blood bank
        const nearestBank = data.nearby_blood_banks[0];
        console.log('✅ Selected nearest blood bank:', nearestBank.name, nearestBank._id);
        return nearestBank._id;
      } else {
        console.warn('⚠️ No nearby blood banks found');
        return null;
      }
    } catch (err) {
      console.error('❌ Error fetching nearby blood banks:', err);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      // Get nearest blood bank ID first
      let selectedBloodBankId = null;
      if (formData.latitude && formData.longitude) {
        selectedBloodBankId = await fetchNearbyBloodBanks(
          formData.latitude,
          formData.longitude
        );
      }

      if (!selectedBloodBankId) {
        error('❌ Could not find nearby blood banks. Please check your location.');
        setSubmitting(false);
        return;
      }

      const userEmail = session?.user?.email || '';

      // Create final payload with guaranteed non-empty fields
      const finalPayload = {
        ...formData,
        unitsRequired: Number(formData.unitsRequired),
        latitude: Number(Number(formData.latitude).toFixed(6)),
        longitude: Number(Number(formData.longitude).toFixed(6)),
        relationToPatient: formData.relationToPatient || 'Hospital',
        requesterName: formData.requesterName || 'Hospital Admin',
        requesterEmail: formData.requesterEmail || userEmail,
        selectedBloodBankId: selectedBloodBankId,
        isLoggedIn: !!session,
        userEmail: userEmail
      };

      // Log final data to verify before sending
      console.log('FINAL DATA SENT:', finalPayload);

      const response = await fetch('/api/emergency/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      });

      const data = await response.json();

      if (data.success) {
        setSubmittedRequestId(data.requestId);
        setShowSuccessModal(true);
        success('🚨 Emergency request broadcasted successfully to nearby donors.');

        setFormData({
          patientName: '',
          contactNumber: '',
          bloodType: '',
          compatibleBloodTypes: [],
          unitsRequired: '',
          hospitalLocation: '',
          emergencyDetails: '',
          latitude: null,
          longitude: null,
          requesterName: '',
          requesterEmail: '',
          relationToPatient: ''
        });
      } else {
        error('Failed to submit request: ' + data.error);
      }
    } catch (err) {
      console.error('Error submitting request:', err);
      error('Failed to submit emergency request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStayOnPage = () => {
    setShowSuccessModal(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-full h-32 w-32 border-b-2 border-[#ef4444]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Emergency Header */}
        <div className="text-center mb-8">
          <div className="bg-[#ef4444] text-white p-4 rounded-lg mb-6">
            <TriangleAlert className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-2">Emergency Blood Request</h1>
            <p className="text-xl opacity-90">Request urgent blood supply for critical situations</p>
          </div>
        </div>
        
        {/* Emergency Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] text-center">
            <Phone className="h-12 w-12 text-[#ef4444] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Emergency Hotline</h3>
            <p className="text-2xl font-bold text-[#ef4444] mb-2">108</p>
            <p className="text-sm text-[var(--text-secondary)]">Available 24/7</p>
          </div>
          
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] text-center">
            <Clock className="h-12 w-12 text-[#ef4444] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Response Time</h3>
            <p className="text-2xl font-bold text-[#ef4444] mb-2">&lt; 30 min</p>
            <p className="text-sm text-[var(--text-secondary)]">Average response</p>
          </div>
          
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] text-center">
            <Users className="h-12 w-12 text-[#ef4444] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Available Donors</h3>
            <p className="text-2xl font-bold text-[#ef4444] mb-2">1,200+</p>
            <p className="text-sm text-[var(--text-secondary)]">Ready to help</p>
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] mb-6">
          <div className="flex items-center mb-4">
            <MapPin className="h-6 w-6 text-[#ef4444] mr-2" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Your Location</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <button
              onClick={getCurrentLocation}
              disabled={location.loading}
              className="flex items-center gap-2 bg-[#ef4444] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#ef4444]/90 transition-colors disabled:opacity-50"
            >
              {location.loading ? (
                <Loader className="h-5 w-5" />
              ) : (
                <Navigation className="h-5 w-5" />
              )}
              {location.loading ? 'Getting Location...' : 'Get My Location'}
            </button>
            
            {location.latitude && location.longitude && (
              <div className="text-sm text-[var(--text-secondary)]">
                <p>Latitude: {location.latitude.toFixed(6)}</p>
                <p>Longitude: {location.longitude.toFixed(6)}</p>
              </div>
            )}
            
            {location.error && (
              <div>
                <p className="text-red-500 text-sm">{location.error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Emergency Request Form */}
        <div className="bg-[var(--card-background)] p-8 rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center mb-6">
            <TriangleAlert className="h-6 w-6 text-[#ef4444] mr-2" />
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Broadcast Emergency to Donors</h2>
          </div>

          {/* User Status Indicator */}
          <div className="mb-6 p-4 rounded-lg border border-[var(--border-color)]">
            {session ? (
              <div className="flex items-center text-green-600">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium">Logged in as {session.user?.email}</span>
              </div>
            ) : (
              <div className="flex items-center text-blue-600">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium">Emergency Access - Additional requester information required</span>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Additional fields for non-logged-in users */}
            {!session && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-4">Requester Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Your Name *
                    </label>
                    <input 
                      type="text" 
                      name="requesterName"
                      value={formData.requesterName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Your Email *
                    </label>
                    <input 
                      type="email" 
                      name="requesterEmail"
                      value={formData.requesterEmail}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your email address"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Relation to Patient *
                    </label>
                    <select 
                      name="relationToPatient"
                      value={formData.relationToPatient}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select your relation to patient</option>
                      <option value="self">Self (I am the patient)</option>
                      <option value="family">Family Member</option>
                      <option value="friend">Friend</option>
                      <option value="medical_staff">Medical Staff</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Patient Name *
                </label>
                <input 
                  type="text" 
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                  placeholder="Enter patient's full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Contact Number *
                </label>
                <input 
                  type="tel" 
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                  placeholder="Enter contact number"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Blood Type *
                </label>
                <select 
                  name="bloodType"
                  value={formData.bloodType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                >
                  <option value="">Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
                
                {/* Blood Compatibility Display */}
                {bloodCompatibilityInfo && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl shadow-sm">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <Droplet className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Blood Compatibility</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{bloodCompatibilityInfo.description}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-3">
                          <Heart className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">Compatible Blood Types</span>
                          <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                            {bloodCompatibilityInfo.compatibilityCount} types
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {bloodCompatibilityInfo.compatibleTypes.map((type, index) => (
                            <div 
                              key={index}
                              className={`relative p-3 rounded-lg text-center font-medium transition-all duration-200 hover:scale-105 ${
                                type === formData.bloodType 
                                  ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/50 dark:to-red-800/50 text-red-800 dark:text-red-200 border-2 border-red-300 dark:border-red-600 shadow-md' 
                                  : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                              }`}
                            >
                              {type === formData.bloodType && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs">★</span>
                                </div>
                              )}
                              <div className="text-lg font-bold">{type}</div>
                              <div className="text-xs opacity-75">
                                {type === formData.bloodType ? 'Your Type' : 'Compatible'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {bloodCompatibilityInfo.alternatives.length > 0 && (
                        <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                          <div className="flex items-center space-x-2 mb-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Alternative Options</span>
                          </div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {bloodCompatibilityInfo.alternatives.join(' • ')}
                          </p>
                        </div>
                      )}
                      
                      {bloodCompatibilityInfo.isUniversalRecipient && (
                        <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 p-3 rounded-lg border border-green-200 dark:border-green-700">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 bg-green-500 rounded-full">
                              <Heart className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-sm font-semibold text-green-800 dark:text-green-200">Universal Recipient</span>
                          </div>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">You can receive blood from any donor type</p>
                        </div>
                      )}
                      
                      {bloodCompatibilityInfo.isUniversalDonor && (
                        <div className="bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 p-3 rounded-lg border border-orange-200 dark:border-orange-700">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 bg-orange-500 rounded-full">
                              <Heart className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">Universal Donor Type</span>
                          </div>
                          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">Your blood type is very valuable for donations</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Units Required *
                </label>
                <input 
                  type="number" 
                  name="unitsRequired"
                  value={formData.unitsRequired}
                  onChange={handleInputChange}
                  min="1"
                  max="10"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                  placeholder="Number of units"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Hospital/Location *
              </label>
              <input 
                type="text" 
                name="hospitalLocation"
                value={formData.hospitalLocation}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                placeholder="Hospital name or location"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Emergency Details *
              </label>
              <textarea 
                rows="4"
                name="emergencyDetails"
                value={formData.emergencyDetails}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                placeholder="Describe the emergency situation and urgency level"
              ></textarea>
            </div>

            {/* Location Information for Broadcasting */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 mb-6">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">Your Location</h3>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    {location.latitude && location.longitude 
                      ? `Broadcasting to donors near: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                      : 'Enable location to broadcast to nearby donors'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#ef4444] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#ef4444]/90 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {submitting ? (
                  <Loader className="h-5 w-5 mr-2" />
                ) : (
                  <TriangleAlert className="h-5 w-5 mr-2" />
                )}
                {submitting ? 'Broadcasting...' : 'Broadcast SOS Request'}
              </button>
              
              <button 
                type="button"
                className="flex-1 bg-[var(--background)] text-[var(--text-primary)] py-3 px-6 rounded-lg font-semibold border border-[var(--border-color)] hover:bg-[var(--card-background)] transition-colors flex items-center justify-center"
              >
                <Phone className="h-5 w-5 mr-2" />
                Call Emergency Hotline
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-[#ef4444]/10 rounded-lg border border-[#ef4444]/20">
            <div className="flex items-start">
              <TriangleAlert className="h-5 w-5 text-[#ef4444] mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-1">Important Note</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  This form will alert verified donors in your area. Once submitted, nearby donors with matching blood types will receive an SOS notification to come to the specified hospital.
                </p>
              </div>
            </div>
          </div>

          {/* Login suggestion for non-logged-in users */}
          {!session && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start">
                <div className="w-5 h-5 bg-blue-500 rounded-full mr-2 mt-0.5 flex-shrink-0 flex items-center justify-center">
                  <span className="text-white text-xs">i</span>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">For Better Experience</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    Consider creating an account for faster emergency requests, tracking your requests, and accessing additional features.
                  </p>
                  <div className="flex gap-2">
                    <Link href="/login" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors">
                      Login
                    </Link>
                    <Link href="/register" className="text-sm border border-blue-600 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                      Sign Up
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Request Submitted Successfully!
              </h3>
              <p className="text-[var(--text-secondary)] mb-4">
                Your emergency blood request has been broadcasted to nearby donors.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
                <p className="text-sm text-[var(--text-secondary)]">Request ID:</p>
                <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                  {submittedRequestId}
                </p>
              </div>
            </div>

            {session ? (
              <div className="space-y-3">
                <Link href="/track-request">
                  <button className="w-full bg-[#ef4444] hover:bg-[#ef4444]/90 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                    <TriangleAlert className="w-4 h-4" />
                    <span>Track Request Status</span>
                  </button>
                </Link>
                <button
                  onClick={handleStayOnPage}
                  className="w-full border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-3 rounded-lg font-medium hover:bg-[var(--card-background)] transition-colors"
                >
                  Submit Another Request
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-[var(--text-secondary)] mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">💡 Track Your Request</p>
                  <p>You can track your request status using the general tracking page!</p>
                </div>
                <Link href="/track-request">
                  <button className="w-full bg-[#ef4444] hover:bg-[#ef4444]/90 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                    <TriangleAlert className="w-4 h-4" />
                    <span>Track Status</span>
                  </button>
                </Link>
                <Link href="/register">
                  <button className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>Create Account</span>
                  </button>
                </Link>
                <button
                  onClick={handleStayOnPage}
                  className="w-full border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-3 rounded-lg font-medium hover:bg-[var(--card-background)] transition-colors"
                >
                  Continue Without Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyPage;