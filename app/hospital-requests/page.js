"use client"
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/context/ToastContext';
import { getCompatibleBloodTypes } from '@/lib/bloodCompatibility';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Droplet,
  Heart,
  Hospital,
  Package,
  Plus,
  Send,
  User,
  XCircle,
  X
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { DeliveryInfoBadge } from '@/components/DeliveryInfoBadge';
import { AutoRoutingStatusBadge } from '@/components/AutoRoutingStatusBadge';
import { AutoRoutingTimeline } from '@/components/AutoRoutingTimeline';
import { HospitalAutoRoutingMap } from '@/components/HospitalAutoRoutingMap';
import { sortByPriority } from '@/lib/bloodRequestUtils';

const HospitalRequests = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { success, error } = useToast();

  // Helper function for authenticated API calls
  const apiCall = async (url, options = {}) => {
    // Check if user is logged in
    if (!session?.user) {
      console.warn('[apiCall] Not authenticated - skipping API call');
      return null;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // Use credentials: 'include' to automatically send NextAuth JWT cookie
      // This is the NextAuth-recommended way to send auth token in cookies
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Sends HTTP-only JWT cookie automatically
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        console.warn('[apiCall] 401 Unauthorized - Token may have expired');
        error('Session expired. Please login again.');
        router.push('/login');
        return null;
      }

      return response;
    } catch (err) {
      console.error('[API Call Error]', err);
      throw err;
    }
  };
  const [requests, setRequests] = useState([]);
  const [availableBloodBanks, setAvailableBloodBanks] = useState([]);
  const [nearestBloodBanks, setNearestBloodBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchingBloodBanks, setSearchingBloodBanks] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showBloodBankSelector, setShowBloodBankSelector] = useState(false);
  const [viewMode, setViewMode] = useState('hospital'); // 'hospital' or 'bloodbank'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseData, setResponseData] = useState({
    action: '',
    message: ''
  });
  const [searchRadius, setSearchRadius] = useState(10);
  const [hospitalLocation, setHospitalLocation] = useState({
    latitude: null,
    longitude: null,
    address: ''
  });
  const [bloodCompatibilityInfo, setBloodCompatibilityInfo] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5); // 5 items per page for History tab
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState(null);
  const [formData, setFormData] = useState({
    bloodbank_id: '',
    request_type: 'patient',
    blood_type: '',
    units_requested: '',
    urgency_level: 'medium',
    is_emergency: false,
    patient_details: {
      name: '',
      age: '',
      condition: ''
    },
    reason: '',
    search_radius: 10
  });

  useEffect(() => {
    // Fetch hospital profile for verification status
    if (!session?.user?.id) return;
    setCheckingProfile(true);
    apiCall(`/api/hospitals?user_id=${session.user.id}`)
      .then(response => {
        if (!response) {
          setCheckingProfile(false);
          return;
        }
        return response.json();
      })
      .then(data => {
        if (data) {
          setVerificationStatus(data.profile?.verification_status || null);
        }
      })
      .catch(err => console.error('Failed to fetch hospital profile', err))
      .finally(() => setCheckingProfile(false));
  }, [session]);

  useEffect(() => {
    // Hospital view only
    setViewMode('hospital');
    // Only fetch if user is logged in
    if (session?.user) {
      fetchRequests();
    } else {
      setLoading(false);
    }
    getCurrentLocation();
  }, [session]);

  useEffect(() => {
    // Fetch requests when view mode changes (only if logged in)
    if (session?.user) {
      fetchRequests();
    }
  }, [viewMode, session?.user]);

  // Real-time Pusher listener for auto_routing status updates
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY || !session?.user?.id) return;

    try {
      const Pusher = require('pusher-js');
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      });

      const channel = pusher.subscribe('blood-channel');

      // Listen for auto_routing status updates
      channel.bind('request:auto_routing_update', (data) => {
        console.log('🚨 Auto-routing update received:', data);
        
        // Update request in local state
        setRequests(prevRequests => 
          prevRequests.map(req => 
            req._id === data.request_id 
              ? {
                  ...req,
                  status: data.status,
                  sos_broadcasted: data.sos_broadcasted || req.sos_broadcasted,
                  forwarded_to: data.forwarded_to || req.forwarded_to
                }
              : req
          )
        );

        // Show toast notification
        if (data.status === 'auto_routing') {
          success('🚨 Auto-routing activated for emergency blood request');
        } else if (data.status === 'accepted') {
          success('✅ Blood bank accepted the auto-routed request!');
        }
      });

      // 🆕 Listen for real-time donor response updates
      channel.bind('sos-response-update', (data) => {
        console.log('✅ Donor response received:', data);
        
        // Update request in local state with new responder
        setRequests(prevRequests => 
          prevRequests.map(req => 
            req._id === data.hospital_request_id 
              ? {
                  ...req,
                  responders: data.responders || req.responders
                }
              : req
          )
        );

        // Update details modal if it's showing this request
        if (detailsRequest && detailsRequest._id === data.hospital_request_id) {
          setDetailsRequest(prev => ({
            ...prev,
            responders: data.responders || prev.responders
          }));
        }

        // Show toast notification
        success(`✅ ${data.donor_name} confirmed donation. Total: ${data.responders_count} donors coming`);
      });

      return () => {
        try {
          channel.unbind_all();
          channel.unsubscribe();
          pusher.disconnect();
        } catch (err) {
          console.error('Error cleaning up Pusher:', err);
        }
      };
    } catch (err) {
      console.error('Error setting up Pusher listener:', err);
    }
  }, [session?.user?.id, success]);

  // Real-time polling for auto_routing status updates
  useEffect(() => {
    if (!session?.user?.id) return;

    // Poll for updates every 5 seconds when viewing active tab with auto_routing requests
    let interval = null;
    
    const hasAutoRoutingRequests = requests.some(r => r.status === 'auto_routing');
    
    if (activeTab === 'active' && hasAutoRoutingRequests) {
      console.log('🔄 Auto-routing requests detected - polling for updates...');
      interval = setInterval(() => {
        fetchRequests();
      }, 5000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [session?.user?.id, activeTab, requests]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          // Try to get address via reverse geocoding
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
              { headers: { 'User-Agent': 'RareBlood-Connect/1.0' } }
            );
            const data = await response.json();
            const address = data.address?.road 
              ? `${data.address.road}, ${data.address.city || data.address.town || 'Unknown'}`
              : data.display_name || 'Current Location';
            
            setHospitalLocation({
              latitude: lat,
              longitude: lon,
              address: address
            });
          } catch (error) {
            console.error('Reverse geocoding error:', error);
            // Fallback if reverse geocoding fails
            setHospitalLocation({
              latitude: lat,
              longitude: lon,
              address: 'Location (Coordinates only)'
            });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          // Set default location if geolocation fails
          setHospitalLocation({
            latitude: 10.7769, // Ho Chi Minh City
            longitude: 106.6961,
            address: '123 Nguyen Hue Boulevard, District 1, Ho Chi Minh City'
          });
        }
      );
    }
  };

  const searchBloodBanks = async () => {
    if (!formData.blood_type || !hospitalLocation.latitude) {
      error('Please select blood type and ensure location is available');
      return;
    }

    setSearchingBloodBanks(true);
    try {
      const response = await apiCall('/api/find-bloodbanks', {
        method: 'POST',
        body: JSON.stringify({
          blood_type: formData.blood_type,
          hospital_latitude: hospitalLocation.latitude,
          hospital_longitude: hospitalLocation.longitude,
          search_radius: searchRadius
        })
      });

      if (!response) return; // apiCall handles auth errors

      if (response.ok) {
        const data = await response.json();
        setAvailableBloodBanks(data.available_blood_banks || []);
        setNearestBloodBanks(data.nearest_blood_banks || []);
        setShowBloodBankSelector(true);
        
        if (data.available_blood_banks?.length > 0) {
          success(`Found ${data.available_blood_banks.length} blood banks with ${formData.blood_type} blood available`);
        } else {
          error(`No blood banks found with ${formData.blood_type} blood in ${searchRadius}km radius. Showing nearest blood banks.`);
        }
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to search blood banks');
      }
    } catch (err) {
      console.error('Error searching blood banks:', err);
      error('Failed to search blood banks');
    } finally {
      setSearchingBloodBanks(false);
    }
  };

  const fetchRequests = async () => {
    // Don't fetch if not logged in
    if (!session?.user) {
      console.warn('⚠️ [fetchRequests] Not authenticated - skipping fetch');
      setLoading(false);
      return;
    }

    try {
      const response = await apiCall(`/api/hospital-requests?role=${viewMode}`);
      
      // apiCall handles 401 and returns null in that case
      if (!response) {
        setLoading(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const sortedRequests = sortByPriority(data.requests || []);
        
        // 🔍 DEBUG: Log first request to see structure
        if (sortedRequests.length > 0) {
          console.log('\n' + '='.repeat(70));
          console.log('📥 API Response - First request structure:');
          console.log('='.repeat(70));
          console.log('Request ID:', sortedRequests[0]._id);
          console.log('Status:', sortedRequests[0].status);
          console.log('sos_broadcasted:', sortedRequests[0].sos_broadcasted);
          console.log('sos_donor_details key exists:', 'sos_donor_details' in sortedRequests[0]);
          console.log('sos_donor_details value:', sortedRequests[0].sos_donor_details);
          if (sortedRequests[0].sos_donor_details?.length > 0) {
            console.log('✅ First donor:', sortedRequests[0].sos_donor_details[0]);
          }
          console.log('='.repeat(70) + '\n');
        }
        
        setRequests(sortedRequests);
      } else {
        console.error('❌ Failed to fetch requests:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
      }
    } catch (err) {
      console.error('❌ Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    
    if (!formData.bloodbank_id || !formData.blood_type || !formData.units_requested || !formData.reason) {
      error('Please fill in all required fields');
      return;
    }

    if (formData.request_type === 'patient') {
      if (!formData.patient_details.name || !formData.patient_details.age || !formData.patient_details.condition) {
        error('Patient details are required for patient requests');
        return;
      }
    }

    try {
      // Always include compatible_blood_types calculated from backend logic
      const compatibleBloodTypes = formData.blood_type ? getCompatibleBloodTypes(formData.blood_type) : [];
      
      // AUTO-ROUTING FIX: Automatically map urgency_level to is_emergency
      // If urgency_level is 'critical' -> is_emergency: true (activates auto-routing)
      // Otherwise -> is_emergency: false
      const isEmergency = formData.urgency_level === 'critical';
      
      const requestData = {
        ...formData,
        is_emergency: isEmergency,  // Explicitly set based on urgency_level
        compatible_blood_types: compatibleBloodTypes,
        hospital_location: hospitalLocation,
        search_radius: searchRadius
      };

      // 🔍 DEBUG: Log the payload being sent
      console.log('\n' + '='.repeat(70));
      console.log('📤 FRONTEND - Hospital Request Payload:');
      console.log('='.repeat(70));
      console.log('urgency_level:', formData.urgency_level);
      console.log('isEmergency (calculated):', isEmergency);
      console.log('is_emergency (in payload):', requestData.is_emergency);
      console.log('Full payload:', JSON.stringify(requestData, null, 2).substring(0, 800));
      console.log('='.repeat(70) + '\n');

      const response = await apiCall('/api/hospital-requests', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      if (!response) return; // apiCall handles auth errors

      if (response.ok) {
        success('Blood request submitted successfully');
        setShowRequestForm(false);
        resetForm();
        fetchRequests();
      } else {
        const data = await response.json();
        error(data.error || 'Failed to submit request');
      }
    } catch (err) {
      error('Failed to submit request');
    }
  };

  const resetForm = () => {
    setFormData({
      bloodbank_id: '',
      request_type: 'patient',
      blood_type: '',
      units_requested: '',
      urgency_level: 'medium',
      is_emergency: false,
      patient_details: {
        name: '',
        age: '',
        condition: ''
      },
      reason: '',
      search_radius: 10
    });
    setAvailableBloodBanks([]);
    setNearestBloodBanks([]);
    setShowBloodBankSelector(false);
    setSearchRadius(10);
    setBloodCompatibilityInfo(null);
  };

  const selectBloodBank = (bloodBank) => {
    setFormData({
      ...formData,
      bloodbank_id: bloodBank.bloodbank_id
    });
    setShowBloodBankSelector(false);
    success(`Selected: ${bloodBank.name}`);
  };

  const handleRequestResponse = (request, action) => {
    setSelectedRequest(request);
    setResponseData({
      action,
      message: ''
    });
    setShowResponseModal(true);
  };

  const submitResponse = async () => {
    if (!selectedRequest || !responseData.action) {
      error('Invalid request or action');
      return;
    }

    try {
      const response = await apiCall('/api/hospital-requests/respond', {
        method: 'POST',
        body: JSON.stringify({
          request_id: selectedRequest._id,
          action: responseData.action,
          message: responseData.message
        })
      });

      if (!response) return; // apiCall handles auth errors

      if (response.ok) {
        success(`Request ${responseData.action} successfully`);
        setShowResponseModal(false);
        setSelectedRequest(null);
        setResponseData({ action: '', message: '' });
        fetchRequests();
      } else {
        const data = await response.json();
        error(data.error || 'Failed to respond to request');
      }
    } catch (err) {
      console.error('Error responding to request:', err);
      error('Failed to respond to request');
    }
  };

  const handleCancelRequest = (request) => {
    console.log('Cancel button clicked, request:', request);
    console.log('Request ID:', request._id);
    setRequestToCancel(request);
    setShowCancelConfirm(true);
  };

  const confirmCancelRequest = async () => {
    if (!requestToCancel) {
      error('No request selected for cancellation');
      return;
    }

    const requestId = requestToCancel._id;
    if (!requestId) {
      error('Request ID is missing. Please try again.');
      return;
    }

    setCancelLoading(true);
    try {
      const url = `/api/hospital-requests/cancel?id=${requestId}`;
      console.log('🔄 Calling API:', url);
      
      const response = await apiCall(url, {
        method: 'PATCH'
      });

      if (!response) {
        setCancelLoading(false);
        return; // apiCall handles auth errors
      }

      console.log('📡 Response status:', response.status, response.statusText);
      
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('❌ Failed to parse JSON:', parseErr);
        data = { error: 'Invalid response from server' };
      }

      console.log('📦 Response data:', data);

      if (response.ok) {
        success('Request cancelled successfully');
        setShowCancelConfirm(false);
        setRequestToCancel(null);
        fetchRequests();
      } else {
        const errorMsg = data?.error || data?.message || `Error ${response.status}: ${response.statusText}`;
        console.error('❌ API Error:', errorMsg);
        error(errorMsg);
      }
    } catch (err) {
      console.error('❌ Network error:', err);
      error(err.message || 'Failed to cancel request');
    } finally {
      setCancelLoading(false);
    }
  };

  // Filter and sort requests based on active tab
  const getFilteredRequests = () => {
    let filtered = [];
    
    if (activeTab === 'active') {
      // Show only pending and auto_routing requests (active)
      filtered = requests.filter(req => req.status === 'pending' || req.status === 'auto_routing');
    } else {
      // Show history: accepted, rejected, fulfilled, cancelled
      filtered = requests.filter(req => 
        ['accepted', 'rejected', 'fulfilled', 'cancelled'].includes(req.status)
      );
    }
    
    // Always sort by date (newest first) - data should already be sorted from API
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  // Pagination logic
  const getDisplayRequests = () => {
    const filtered = getFilteredRequests();
    
    if (activeTab === 'active') {
      // No pagination for active requests
      return filtered;
    } else {
      // Pagination for history
      const startIdx = (currentPage - 1) * itemsPerPage;
      const endIdx = startIdx + itemsPerPage;
      return filtered.slice(startIdx, endIdx);
    }
  };

  const getTotalPages = () => {
    if (activeTab === 'active') return 1;
    
    const filtered = getFilteredRequests();
    return Math.ceil(filtered.length / itemsPerPage);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset to page 1 when changing tabs
  };

  const handleNextPage = () => {
    if (currentPage < getTotalPages()) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'accepted': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'fulfilled': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'accepted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'fulfilled': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 font-bold';
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check verification status - show pending approval message if not verified
  if (!checkingProfile && verificationStatus && verificationStatus !== 'verified') {
    return (
      <ProtectedRoute allowedRoles={['hospital']}>
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-[var(--card-background)] border-2 border-yellow-400 rounded-lg p-8 text-center">
              <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                {verificationStatus === 'pending' ? 'Verification Pending' : 'Verification Rejected'}
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
                {verificationStatus === 'pending' 
                  ? 'Your hospital license is currently under review by our admin team. Please wait while we verify your documents.' 
                  : 'Your hospital registration was rejected. Please contact support for more information.'}
              </p>
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  Status: <span className="font-bold text-yellow-600">{verificationStatus}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['hospital']}>
      <div className="min-h-screen bg-[var(--background)] py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Hospital className="h-8 w-8 text-[#ef4444]" />
              <div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">Blood Requests</h1>
                <p className="text-[var(--text-secondary)]">Request blood units from blood banks</p>
              </div>
            </div>
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center space-x-2 bg-[#ef4444] text-white px-6 py-3 rounded-lg hover:bg-[#ef4444]/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>New Request</span>
            </button>
          </div>

          {/* Request Form Modal */}
          {showRequestForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className={`bg-[var(--card-background)] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto transition-all ${
                formData.is_emergency 
                  ? 'border-2 border-red-600' 
                  : 'border border-[var(--border-color)]'
              }`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">New Blood Request</h2>
                    {formData.is_emergency && (
                      <span className="px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-full">🚨 EMERGENCY BROADCAST ACTIVE</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowRequestForm(false)}
                    className="p-2 hover:bg-[var(--background)] rounded-lg transition-colors"
                  >
                    <XCircle className="h-6 w-6 text-[var(--text-secondary)]" />
                  </button>
                </div>

                <form onSubmit={handleSubmitRequest} className="space-y-6">
                  {/* Location and Search Radius */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Hospital Location
                      </label>
                      <div className="text-sm text-[var(--text-secondary)] p-3 bg-[var(--background)] rounded-lg border">
                        {hospitalLocation.latitude ? 
                          `${hospitalLocation.address} (${hospitalLocation.latitude.toFixed(4)}, ${hospitalLocation.longitude.toFixed(4)})` : 
                          'Getting location...'
                        }
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Search Radius (km)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={searchRadius}
                        onChange={(e) => setSearchRadius(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  {/* Request Type */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Request Type *
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, request_type: 'patient'})}
                        className={`p-4 border rounded-lg text-center transition-colors ${
                          formData.request_type === 'patient'
                            ? 'border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]'
                            : 'border-[var(--border-color)] hover:bg-[var(--background)]'
                        }`}
                      >
                        <User className="h-8 w-8 mx-auto mb-2" />
                        <div className="font-medium">Patient</div>
                        <div className="text-sm opacity-75">For patient treatment</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, request_type: 'inventory'})}
                        className={`p-4 border rounded-lg text-center transition-colors ${
                          formData.request_type === 'inventory'
                            ? 'border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]'
                            : 'border-[var(--border-color)] hover:bg-[var(--background)]'
                        }`}
                      >
                        <Package className="h-8 w-8 mx-auto mb-2" />
                        <div className="font-medium">Inventory</div>
                        <div className="text-sm opacity-75">For stock replenishment</div>
                      </button>
                    </div>
                  </div>

                  {/* Blood Type and Search */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Blood Type *
                      </label>
                      <select
                        value={formData.blood_type}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData({...formData, blood_type: value});
                          if (value) {
                            const compatibleTypes = getCompatibleBloodTypes(value);
                            setBloodCompatibilityInfo({
                              compatibleTypes,
                              description: `Patient with blood type ${value} can receive: ${compatibleTypes.join(', ')}`,
                              compatibilityCount: compatibleTypes.length,
                              alternatives: compatibleTypes.filter(t => t !== value),
                              isUniversalRecipient: value === 'AB+',
                              isUniversalDonor: value === 'O-'
                            });
                          } else {
                            setBloodCompatibilityInfo(null);
                          }
                        }}
                        className="w-full px-4 py-3 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                        required
                      >
                        <option value="">Select blood type</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Units Requested *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.units_requested}
                        onChange={(e) => setFormData({...formData, units_requested: e.target.value})}
                        className="w-full px-4 py-3 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={searchBloodBanks}
                        disabled={!formData.blood_type || searchingBloodBanks}
                        className="w-full px-4 py-3 bg-[#ef4444] text-white rounded-lg hover:bg-[#ef4444]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {searchingBloodBanks ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            Searching...
                          </>
                        ) : (
                          <>
                            <Building2 className="h-4 w-4 mr-2" />
                            Find Blood Banks
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Blood Compatibility Card - ALWAYS SHOWN when blood_type is selected */}
                  {formData.blood_type && (
                    <div className={`mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl shadow-sm transition-all ${
                      formData.urgency_level === 'critical' && formData.is_emergency
                        ? 'border-4 border-red-500 dark:border-red-600'
                        : 'border border-blue-200 dark:border-blue-700'
                    }`}>

                      <div className="flex flex-row items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
                          <Droplet className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Blood Compatibility</h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{bloodCompatibilityInfo?.description || `Patient with blood type ${formData.blood_type} can receive compatible blood types`}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="w-full">
                          <div className="flex items-center space-x-2 mb-3">
                            <Heart className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">Compatible Blood Types</span>
                            <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                              {bloodCompatibilityInfo?.compatibilityCount || '8'} types
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                            {(bloodCompatibilityInfo?.compatibleTypes || []).map((type, index) => (
                              <div 
                                key={index}
                                className={`relative p-3 rounded-lg text-center font-medium transition-all duration-200 hover:scale-105 ${
                                  type === formData.blood_type 
                                    ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/50 dark:to-red-800/50 text-red-800 dark:text-red-200 border-2 border-red-300 dark:border-red-600 shadow-md' 
                                    : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                                }`}
                              >
                                {type === formData.blood_type && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">★</span>
                                  </div>
                                )}
                                <div className="text-lg font-bold">{type}</div>
                                <div className="text-xs opacity-75">
                                  {type === formData.blood_type ? 'Your Type' : 'Compatible'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {(bloodCompatibilityInfo?.alternatives?.length > 0) && (
                          <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                            <div className="flex flex-row items-center space-x-2 mb-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Alternative Options</span>
                            </div>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              {bloodCompatibilityInfo?.alternatives.join(' • ')}
                            </p>
                          </div>
                        )}
                        {bloodCompatibilityInfo?.isUniversalRecipient && (
                          <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 p-3 rounded-lg border border-green-200 dark:border-green-700">
                            <div className="flex flex-row items-center space-x-2">
                              <div className="p-1 bg-green-500 rounded-full flex-shrink-0">
                                <Heart className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-sm font-semibold text-green-800 dark:text-green-200">Universal Recipient</span>
                            </div>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">Patient can receive blood from all blood types</p>
                          </div>
                        )}
                        {bloodCompatibilityInfo?.isUniversalDonor && (
                          <div className="bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 p-3 rounded-lg border border-orange-200 dark:border-orange-700">
                            <div className="flex flex-row items-center space-x-2">
                              <div className="p-1 bg-orange-500 rounded-full flex-shrink-0">
                                <Heart className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">Universal Donor Type</span>
                            </div>
                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">This blood type is valuable for donations</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Blood Bank Selection */}
                  {showBloodBankSelector && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Select Blood Bank *
                      </label>
                      
                      {/* Available Blood Banks */}
                      {availableBloodBanks.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-green-600 mb-3 flex items-center">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Available Blood Banks ({formData.blood_type} in stock)
                          </h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {availableBloodBanks.map((bank) => (
                              <div
                                key={bank.bloodbank_id}
                                onClick={() => selectBloodBank(bank)}
                                className={`p-3 border rounded-lg cursor-pointer hover:bg-[var(--background)] transition-colors ${
                                  formData.bloodbank_id === bank.bloodbank_id
                                    ? 'border-[#ef4444] bg-[#ef4444]/10'
                                    : 'border-[var(--border-color)]'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium text-[var(--text-primary)]">{bank.name}</div>
                                    <div className="text-sm text-[var(--text-secondary)]">{bank.email}</div>
                                    {bank.address && (
                                      <div className="text-xs text-[var(--text-secondary)]">{bank.address}</div>
                                    )}
                                    <div className="text-xs text-green-600 font-medium">
                                      {bank.available_units} {bank.available_units === 1 ? 'unit' : 'units'} of {formData.blood_type} available
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-[var(--text-primary)]">{bank.distance} km</div>
                                    {bank.within_radius && (
                                      <div className="text-xs text-green-600">Within radius</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nearest Blood Banks (if no stock available) */}
                      {nearestBloodBanks.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-yellow-600 mb-3 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Nearest Blood Banks (No {formData.blood_type} in stock)
                          </h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {nearestBloodBanks.map((bank) => (
                              <div
                                key={bank.bloodbank_id}
                                onClick={() => selectBloodBank(bank)}
                                className={`p-3 border rounded-lg cursor-pointer hover:bg-[var(--background)] transition-colors ${
                                  formData.bloodbank_id === bank.bloodbank_id
                                    ? 'border-[#ef4444] bg-[#ef4444]/10'
                                    : 'border-[var(--border-color)]'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium text-[var(--text-primary)]">{bank.name}</div>
                                    <div className="text-sm text-[var(--text-secondary)]">{bank.email}</div>
                                    {bank.address && (
                                      <div className="text-xs text-[var(--text-secondary)]">{bank.address}</div>
                                    )}
                                    <div className="text-xs text-red-600">
                                      No {formData.blood_type} currently available
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-[var(--text-primary)]">{bank.distance} km</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Urgency Level */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Urgency Level *
                    </label>
                    <select
                      value={formData.urgency_level}
                      onChange={(e) => {
                        const value = e.target.value;
                        const isEmergency = value === 'critical';
                        setFormData({
                          ...formData,
                          urgency_level: value,
                          is_emergency: isEmergency
                        });
                      }}
                      className="w-full px-4 py-3 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">🚨 Critical (Auto Emergency)</option>
                    </select>
                  </div>

                  {/* Auto Emergency Info */}
                  {formData.is_emergency && (
                    <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-300 dark:border-red-600 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-1">🚨</span>
                        <div>
                          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-1">Emergency Broadcast Activated</h4>
                          <p className="text-sm text-red-600 dark:text-red-300">
                            This request will trigger an emergency broadcast to all compatible donors within the search radius. The blood compatibility table below shows which blood types will be targeted.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Patient Details (conditional) */}
                  {formData.request_type === 'patient' && (
                    <div className="space-y-4 p-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                      <h3 className="font-medium text-[var(--text-primary)]">Patient Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                            Patient Name *
                          </label>
                          <input
                            type="text"
                            value={formData.patient_details.name}
                            onChange={(e) => setFormData({
                              ...formData,
                              patient_details: {...formData.patient_details, name: e.target.value}
                            })}
                            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                            required={formData.request_type === 'patient'}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                            Age *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.patient_details.age}
                            onChange={(e) => setFormData({
                              ...formData,
                              patient_details: {...formData.patient_details, age: e.target.value}
                            })}
                            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                            required={formData.request_type === 'patient'}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                          Medical Condition *
                        </label>
                        <input
                          type="text"
                          value={formData.patient_details.condition}
                          onChange={(e) => setFormData({
                            ...formData,
                            patient_details: {...formData.patient_details, condition: e.target.value}
                          })}
                          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                          placeholder="e.g., Surgery, Accident, Cancer treatment"
                          required={formData.request_type === 'patient'}
                        />
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Reason for Request *
                    </label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({...formData, reason: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-3 border border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-[var(--text-primary)]"
                      placeholder="Provide detailed reason for the blood request..."
                      required
                    />
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex space-x-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center space-x-2 bg-[#ef4444] text-white px-6 py-3 rounded-lg hover:bg-[#ef4444]/90 transition-colors"
                    >
                      <Send className="h-5 w-5" />
                      <span>Submit Request</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRequestForm(false)}
                      className="px-6 py-3 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Requests List */}
          <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
            <div className="p-6 border-b border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)]">Your Blood Requests</h2>
                  <p className="text-[var(--text-secondary)] mt-1">Track your submitted blood requests</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-[var(--border-color)]">
                <button
                  onClick={() => handleTabChange('active')}
                  className={`px-4 py-3 font-medium transition-colors relative ${
                    activeTab === 'active'
                      ? 'text-[#ef4444]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>Active Requests</span>
                  {activeTab === 'active' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#ef4444] rounded-t-sm"></div>
                  )}
                  <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded font-semibold">
                    {requests.filter(r => r.status === 'pending' || r.status === 'auto_routing').length}
                  </span>
                  {requests.filter(r => r.status === 'auto_routing').length > 0 && (
                    <span className="ml-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded font-semibold border border-orange-300 dark:border-orange-600">
                      🚨 {requests.filter(r => r.status === 'auto_routing').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange('history')}
                  className={`px-4 py-3 font-medium transition-colors relative ${
                    activeTab === 'history'
                      ? 'text-[#ef4444]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>History</span>
                  {activeTab === 'history' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#ef4444] rounded-t-sm"></div>
                  )}
                  <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 px-2 py-1 rounded">
                    {requests.filter(r => ['accepted', 'rejected', 'fulfilled', 'cancelled'].includes(r.status)).length}
                  </span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="rounded-full h-8 w-8 border-b-2 border-[#ef4444]"></div>
                </div>
              ) : getFilteredRequests().length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="h-16 w-16 text-[var(--text-secondary)] mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)] text-lg">
                    {activeTab === 'active' ? 'No active requests' : 'No history yet'}
                  </p>
                  <p className="text-[var(--text-secondary)] text-sm mt-2">
                    {activeTab === 'active' 
                      ? 'Submit a new blood request to get started' 
                      : 'Your completed requests will appear here'}
                  </p>
                </div>
              ) : (
                <>
                <table className="min-w-full">
                  <thead className="bg-[var(--background)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Request Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Blood Bank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Type & Urgency
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {getDisplayRequests().map((request) => {
                      // 🔍 DEBUG: Log each request before rendering
                      if (request.status === 'auto_routing') {
                        console.log(`🟡 [TABLE ROW] Rendering request ${request._id.slice(-4)}:`, {
                          status: request.status,
                          sos_broadcasted_count: request.sos_broadcasted?.donors_notified,
                          sos_donor_details_exists: 'sos_donor_details' in request,
                          sos_donor_details_length: request.sos_donor_details?.length,
                          sos_donor_details: request.sos_donor_details
                        });
                      }
                      
                      return (
                      <tr key={request._id} className="hover:bg-[var(--background)]">
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-[#ef4444] rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {request.blood_type}
                              </div>
                              <div>
                                <div className="font-medium text-[var(--text-primary)]">
                                  {request.blood_type} - {request.units_requested} {request.units_requested === 1 ? 'unit' : 'units'}
                                </div>
                                {request.patient_details && (
                                  <div className="text-sm text-[var(--text-secondary)]">
                                    Patient: {request.patient_details.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4 text-[var(--text-secondary)]" />
                            <span className="text-[var(--text-primary)]">{request.bloodbank_id?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                              {request.request_type === 'patient' ? 
                                <User className="h-4 w-4" /> : 
                                <Package className="h-4 w-4" />
                              }
                              <span className="text-sm text-[var(--text-primary)] capitalize">
                                {request.request_type}
                              </span>
                            </div>
                            {request.urgency_level && (
                              <PriorityBadge urgency={request.urgency_level} size="sm" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            {request.status === 'auto_routing' ? (
                              <AutoRoutingStatusBadge
                                sos_broadcasted={request.sos_broadcasted}
                                sos_donor_details={request.sos_donor_details}
                                forwarded_to={request.forwarded_to}
                                blood_type={request.blood_type}
                                units_needed={request.units_requested}
                                responders={request.responders}
                                compact={true}
                              />
                            ) : (
                              <>
                                <StatusBadge status={request.status} size="sm" />
                                {request.response_message && (
                                  <div className="text-sm text-[var(--text-secondary)] max-w-xs">
                                    {request.response_message}
                                  </div>
                                )}
                                {request.delivery_info && (request.status === 'accepted' || request.status === 'fulfilled') && (
                                  <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">🚑 DELIVERY INFO:</span>
                                    </div>
                                    <div className="text-xs space-y-1">
                                      <div className="flex items-center gap-1">
                                        <span className="font-semibold text-[var(--text-primary)]">Driver:</span>
                                        <span className="text-[var(--text-secondary)]">{request.delivery_info.driver_name}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="font-semibold text-[var(--text-primary)]">Phone:</span>
                                        <a href={`tel:${request.delivery_info.driver_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                          {request.delivery_info.driver_phone}
                                        </a>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="font-semibold text-[var(--text-primary)]">ETA:</span>
                                        <span className="text-[var(--text-secondary)]">{request.delivery_info.estimated_minutes} min</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(request.created_at)}</span>
                          </div>
                          {request.responded_at && (
                            <div className="text-xs text-[var(--text-secondary)] mt-1">
                              Responded: {formatDate(request.responded_at)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {request.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setDetailsRequest(request);
                                  setShowDetailsModal(true);
                                }}
                                className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium transition-colors dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400"
                              >
                                <span>View</span>
                              </button>
                              <button
                                onClick={() => handleCancelRequest(request)}
                                className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium transition-colors dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400"
                              >
                                <X className="h-4 w-4" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          ) : request.status === 'auto_routing' ? (
                            <div className="space-y-2">
                              <button
                                onClick={() => {
                                  setDetailsRequest(request);
                                  setShowDetailsModal(true);
                                }}
                                className="w-full flex items-center justify-center space-x-1 px-3 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm font-medium transition-colors dark:bg-orange-900/20 dark:hover:bg-orange-900/40 dark:text-orange-400 border border-orange-300 dark:border-orange-600"
                              >
                                <span>📊 View Details</span>
                              </button>
                              <button
                                disabled={true}
                                title="Cannot cancel requests during auto-routing. System is actively searching for blood."
                                className="w-full flex items-center justify-center space-x-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium cursor-not-allowed opacity-50 dark:bg-gray-900/20 dark:text-gray-500 border border-gray-300 dark:border-gray-700"
                              >
                                <X className="h-4 w-4" />
                                <span>Cancel</span>
                              </button>
                              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">🔒 Auto-routing in progress</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setDetailsRequest(request);
                                setShowDetailsModal(true);
                              }}
                              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors dark:bg-gray-900/20 dark:hover:bg-gray-900/40 dark:text-gray-400"
                            >
                              <span>View</span>
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls - Only show for History tab */}
                {activeTab === 'history' && getTotalPages() > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)] bg-[var(--background)]">
                    <div className="text-sm text-[var(--text-secondary)]">
                      Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{getTotalPages()}</span> 
                      {' '} ({getFilteredRequests().length} total records)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Previous
                      </button>
                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === getTotalPages()}
                        className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          </div>

          {/* Request Details Modal */}
          {showDetailsModal && detailsRequest && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-[var(--card-background)] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                    Request Details
                  </h3>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setDetailsRequest(null);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6 text-[var(--text-secondary)]" />
                  </button>
                </div>

                {/* Auto-Routing Alert Banner - PROMINENT */}
                {detailsRequest.status === 'auto_routing' && (
                  <>
                    <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-2 border-orange-400 dark:border-orange-600 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">🚨</div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-orange-900 dark:text-orange-200 mb-2">
                            ⚠️ Auto-Routing System Activated
                          </h4>
                          <p className="text-sm text-orange-800 dark:text-orange-300 mb-3">
                            Primary blood bank rejected blood supply due to insufficient stock. System has automatically:
                          </p>
                          <ul className="space-y-2 text-sm text-orange-800 dark:text-orange-300">
                            <li className="flex items-center gap-2">
                              <span className="text-lg">📢</span>
                              <span>
                                <strong>SOS Broadcast:</strong> Notified{' '}
                                <span className="font-bold text-red-600 dark:text-red-400">
                                  {detailsRequest.sos_broadcasted?.donors_notified ?? detailsRequest.sos_broadcasted?.donors_fcm_sent ?? 0}
                                </span>
                                {' '}nearby donors within 10km radius
                              </span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-lg">🏥</span>
                              <span>
                                <strong>Routing:</strong> Forwarded request to{' '}
                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                  {detailsRequest.forwarded_to?.length || 0}
                                </span>
                                {' '}alternative blood {(detailsRequest.forwarded_to?.length || 0) === 1 ? 'bank' : 'banks'}
                              </span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <style>{`
                      @keyframes float {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-4px); }
                      }
                      .modal-alert-float {
                        animation: float 2s ease-in-out infinite;
                      }
                    `}</style>

                    {/* Auto-Routing Timeline */}
                    <AutoRoutingTimeline hospitalRequest={detailsRequest} />
                  </>
                )}

                {/* Basic Details */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Blood Type</p>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-[#ef4444] rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {detailsRequest.blood_type}
                      </div>
                      <span className="text-lg font-bold text-[var(--text-primary)]">{detailsRequest.blood_type}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Units Requested</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{detailsRequest.units_requested} {detailsRequest.units_requested === 1 ? 'unit' : 'units'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={detailsRequest.status} size="sm" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{detailsRequest.status}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Urgency Level</p>
                    <PriorityBadge urgency={detailsRequest.urgency_level} size="sm" />
                  </div>
                </div>

                {/* Blood Bank Info */}
                <div className="mb-6 p-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                  <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Blood Bank Assigned</p>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-[#ef4444]" />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{detailsRequest.bloodbank_id?.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{detailsRequest.bloodbank_id?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Patient Details (if applicable) */}
                {detailsRequest.patient_details && (
                  <div className="mb-6 p-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Patient Information</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Name:</span>
                        <span className="font-medium text-[var(--text-primary)]">{detailsRequest.patient_details.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Age:</span>
                        <span className="font-medium text-[var(--text-primary)]">{detailsRequest.patient_details.age}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Condition:</span>
                        <span className="font-medium text-[var(--text-primary)]">{detailsRequest.patient_details.condition}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-Routing Details (if applicable) */}
                {detailsRequest.status === 'auto_routing' && (
                  <>
                    {/* SOS Broadcast Details */}
                    {detailsRequest.sos_broadcasted && (
                      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-600 rounded-lg">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-3">📢 SOS Broadcast Status</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-emerald-600 dark:text-emerald-400">Triggered:</span>
                            <span className="font-medium text-[var(--text-primary)]">
                              {detailsRequest.sos_broadcasted.triggered ? '✅ Yes' : '❌ No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-600 dark:text-emerald-400">Donors Notified:</span>
                            <span className="font-bold text-red-600">
                              {detailsRequest.sos_broadcasted.donors_notified ?? 
                               detailsRequest.sos_broadcasted.donors_fcm_sent ?? 
                               detailsRequest.sos_broadcasted.total_donors_found ?? 0} donors
                            </span>
                          </div>
                          {detailsRequest.sos_broadcasted.broadcasted_at && (
                            <div className="flex justify-between">
                              <span className="text-emerald-600 dark:text-emerald-400">Broadcast Time:</span>
                              <span className="text-xs text-[var(--text-secondary)]">
                                {new Date(detailsRequest.sos_broadcasted.broadcasted_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SOS Notified Donors List - NEW SECTION */}
                    {detailsRequest.sos_donor_details && detailsRequest.sos_donor_details.length > 0 && (
                      <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-400 dark:border-orange-600 rounded-lg">
                        <p className="text-sm font-bold text-orange-700 dark:text-orange-300 mb-4 flex items-center gap-2">
                          <span className="text-lg">📞</span>
                          {detailsRequest.sos_donor_details.length} Donors Received SOS Alert
                        </p>
                        <div className="space-y-3">
                          {detailsRequest.sos_donor_details.map((donor, idx) => (
                            <div key={idx} className="p-3 bg-white dark:bg-[var(--background)] rounded-lg border border-orange-200 dark:border-orange-700">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-[var(--text-primary)]">
                                      👤 {donor.name || 'Unknown Donor'}
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                      {donor.email}
                                    </p>
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  donor.response_status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                  donor.response_status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                  {donor.response_status === 'accepted' ? '✅ Accepted' :
                                   donor.response_status === 'rejected' ? '❌ Rejected' :
                                   '⏳ Pending'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mt-2 pt-2 border-t border-orange-100 dark:border-orange-700">
                                <div>
                                  <span className="font-medium">Phone:</span> {donor.phone || 'N/A'}
                                </div>
                                <div>
                                  <span className="font-medium">Blood:</span> {donor.blood_type}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-3 italic">
                          📡 These donors received emergency SOS alerts. Follow-up based on their response status.
                        </p>
                      </div>
                    )}

                    {/* Blood Compatibility Information */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-300 dark:border-rose-600 rounded-lg">
                      <p className="text-sm font-medium text-rose-700 dark:text-rose-300 mb-3">🩸 Blood Type & Compatibility</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {detailsRequest.blood_type}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
                              Required Blood Type:
                            </p>
                            <p className="text-xs text-rose-700 dark:text-rose-300">
                              System is searching for blood type <span className="font-bold">{detailsRequest.blood_type}</span>
                            </p>
                          </div>
                        </div>

                        {detailsRequest.compatible_blood_types && detailsRequest.compatible_blood_types.length > 0 && (
                          <div className="pt-3 border-t border-rose-200 dark:border-rose-700">
                            <p className="text-sm font-medium text-rose-900 dark:text-rose-100 mb-2">
                              Compatible Blood Types:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {detailsRequest.compatible_blood_types.map((bloodType, idx) => (
                                <div
                                  key={idx}
                                  className="px-3 py-1 bg-white dark:bg-[var(--background)] rounded-full border border-rose-300 dark:border-rose-600 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1"
                                >
                                  <span className="w-5 h-5 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400 text-xs font-bold">
                                    {bloodType.slice(0, 1)}
                                  </span>
                                  {bloodType}
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">
                              ℹ️ These blood types can meet patient needs if the primary blood type is unavailable.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Forwarded Blood Banks */}
                    {detailsRequest.forwarded_to && detailsRequest.forwarded_to.length > 0 && (
                      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600 rounded-lg">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">🏥 Forwarded to Blood Banks</p>
                        <div className="space-y-2">
                          {detailsRequest.forwarded_to.map((forward, idx) => (
                            <div key={idx} className="p-3 bg-white dark:bg-[var(--background)] rounded border border-blue-200 dark:border-blue-700">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${
                                  forward.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
                                  forward.status === 'accepted' ? 'text-green-600 dark:text-green-400' :
                                  'text-red-600 dark:text-red-400'
                                }`}>
                                  {forward.status === 'pending' ? '⏳ Pending' :
                                   forward.status === 'accepted' ? '✅ Accepted' :
                                   '❌ Rejected'}
                                </span>
                                <span className="text-xs text-[var(--text-secondary)]">
                                  {new Date(forward.forwarded_at).toLocaleString('vi-VN')}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--text-secondary)]">
                                Blood Bank: <span className="font-medium">{forward.bloodbank_id?.toString().slice(-6)}</span>
                              </p>
                              {forward.reason && (
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                  Reason: {forward.reason}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Donors Who Confirmed - Real-time Update */}
                {detailsRequest.status === 'auto_routing' && detailsRequest.responders && detailsRequest.responders.length > 0 && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-lime-50 to-emerald-50 dark:from-lime-900/20 dark:to-emerald-900/20 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-4 flex items-center gap-2">
                      <span className="text-lg">✅</span>
                      {detailsRequest.responders.length} Donors Confirmed - On Their Way
                    </p>
                    <div className="space-y-2">
                      {detailsRequest.responders.map((responder, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-[var(--background)] rounded-lg border border-emerald-200 dark:border-emerald-700 flex items-center justify-between">
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            👤 {responder.donorId?.name || 'Donor'}
                          </span>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            {new Date(responder.respondedAt).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3 italic">
                      💡 Hospital can contact these donors through blood banks to coordinate delivery.
                    </p>
                  </div>
                )}

                {/* Request Reason */}
                {detailsRequest.reason && (
                  <div className="mb-6 p-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Request Reason</p>
                    <p className="text-sm text-[var(--text-primary)]">{detailsRequest.reason}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="mb-6 p-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--text-secondary)] mb-1">Created:</p>
                      <p className="font-medium text-[var(--text-primary)]">
                        {new Date(detailsRequest.created_at).toLocaleString()}
                      </p>
                    </div>
                    {detailsRequest.responded_at && (
                      <div>
                        <p className="text-[var(--text-secondary)] mb-1">Responded:</p>
                        <p className="font-medium text-[var(--text-primary)]">
                          {new Date(detailsRequest.responded_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setDetailsRequest(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-lg bg-[#ef4444] hover:bg-[#ef4444]/90 text-white font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Confirmation Dialog */}
          {showCancelConfirm && requestToCancel && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-[var(--card-background)] rounded-xl p-6 w-full max-w-md border border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Confirm Cancellation
                  </h3>
                  <button
                    onClick={() => {
                      setShowCancelConfirm(false);
                      setRequestToCancel(null);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-[var(--text-secondary)]" />
                  </button>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30 rounded-lg p-4 mb-6">
                  <p className="text-[var(--text-primary)] font-medium mb-2">
                    Are you sure you want to cancel this blood request?
                  </p>
                  <div className="text-sm text-[var(--text-secondary)] space-y-1">
                    <p>
                      <span className="font-medium">Blood Type:</span> {requestToCancel.blood_type}
                    </p>
                    <p>
                      <span className="font-medium">Units:</span> {requestToCancel.units_requested}
                    </p>
                    <p>
                      <span className="font-medium">Blood Bank:</span> {requestToCancel.bloodbank_id?.name}
                    </p>
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
                    This action will mark the request as cancelled. The record will be kept for history purposes.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCancelConfirm(false);
                      setRequestToCancel(null);
                    }}
                    disabled={cancelLoading}
                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors disabled:opacity-50"
                  >
                    Keep Request
                  </button>
                  <button
                    onClick={confirmCancelRequest}
                    disabled={cancelLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelLoading ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default HospitalRequests;
