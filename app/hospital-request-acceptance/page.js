"use client"
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/context/ToastContext';
import usePusherRefresh from '@/hooks/usePusherRefresh';
import {
    Building2,
    CheckCircle,
    Clock,
    Droplet,
    Hospital,
    Package,
    Phone,
    User,
    XCircle,
    AlertTriangle,
    AlertCircle
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { AcceptRequestModal } from '@/components/AcceptRequestModal';
import { RejectionResponseModal } from '@/components/RejectionResponseModal';
import { sortByPriority, isEmergencyRequest } from '@/lib/bloodRequestUtils';

const HospitalRequestAcceptance = () => {
  const { data: session } = useSession();
  const { success, error } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatusTab, setActiveStatusTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseData, setResponseData] = useState({
    action: '',
    message: ''
  });
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  });
  
  // Rejection response modal state
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionResponse, setRejectionResponse] = useState({
    reason: '',
    nearbyDonorsNotified: 0,
    donorContactRequestsCreated: 0,
    notificationsSent: 0,
    bloodType: '',
    unitsRequested: 0,
    hospitalName: ''
  });

  // Helper function to add headers with NextAuth session cookie support
  const getAuthHeaders = (additionalHeaders = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };
    
    // NextAuth automatically sends session cookie via 'credentials: include'
    // No need to manually add Bearer token - the JWT is in the secure HTTP-only cookie
    console.log('✅ Headers prepared (session cookie will be sent via credentials: include)');
    
    return headers;
  };

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check session
      console.log('📊 Current session:', {
        loaded: !!session,
        user: session?.user ? { id: session.user.id, role: session.user.role } : null
      });

      if (!session) {
        console.warn('⏳ Session not yet loaded, will retry in 1 second...');
        setLoading(false);
        // Retry after 1 second if session not ready
        setTimeout(fetchRequests, 1000);
        return;
      }

      const headers = getAuthHeaders();
      console.log('📤 Fetching hospital requests...');

      const response = await fetch('/api/hospital-requests?role=bloodbank', {
        method: 'GET',
        headers: headers,
        credentials: 'include',  // 🔑 CRITICAL: Send session cookie as authentication
        cache: 'no-store',
      });

      console.log('📥 API Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const data = await response.json();
        const sortedRequests = sortByPriority(data.requests || []);
        setRequests(sortedRequests);
        console.log(`✅ Loaded ${sortedRequests.length} requests`);
        
        const requestStats = {
          pending: sortedRequests.filter(r => r.status === 'pending').length,
          approved: sortedRequests.filter(r => r.status === 'accepted').length,
          rejected: sortedRequests.filter(r => r.status === 'rejected').length
        };
        setStats(requestStats);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          message: errorData?.error || 'Unknown error',
          detail: errorData?.debug || ''
        });
        
        if (response.status === 401) {
          error('🔐 Authentication failed. Please log in again.');
        } else {
          error(`Failed to load requests (${response.status})`);
        }
      }
    } catch (fetchError) {
      console.error('💥 Network Error:', fetchError);
      error('Failed to load requests. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [session, error]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Subscribe to real-time updates via Pusher
  usePusherRefresh(fetchRequests, 'blood-channel', 'new-alert');

  const handleResponseRequest = (request, action) => {
    setSelectedRequest(request);
    setResponseData({ action, message: '' });
    
    // If accepting, show delivery modal instead of response modal
    if (action === 'accepted') {
      setShowDeliveryModal(true);
    } else {
      // For rejection, show the traditional response modal
      setShowResponseModal(true);
    }
  };

  const handleConfirmDelivery = async (deliveryInfo) => {
    if (!selectedRequest) return;
    
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/hospital-requests?id=${selectedRequest._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'accepted',
          response_message: `Blood bank accepted the request and confirmed delivery.`,
          delivery_info: deliveryInfo
        })
      });

      if (response.ok) {
        const responseData_result = await response.json();
        success(`✅ Request accepted! Delivery info has been sent to the hospital.`);

        // Close modal and refresh
        setShowDeliveryModal(false);
        setSelectedRequest(null);
        setResponseData({ action: '', message: '' });
        fetchRequests();
      } else {
        const data = await response.json();
        error(data.error || 'Failed to respond to request');
      }
    } catch (fetchError) {
      console.error('Error responding to request:', fetchError);
      error('Failed to respond to request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!responseData.message.trim()) {
      error('Please provide a response message');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/hospital-requests?id=${selectedRequest._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: responseData.action,
          response_message: responseData.message
        })
      });

      if (response.ok) {
        const responseData_result = await response.json();
        
        // Handle rejection with auto-routing
        if (responseData.action === 'rejected') {
          console.log('🚫 REQUEST REJECTED - Auto-routing initiated');
          
          // Check if auto-routing was triggered (for emergency requests)
          if (responseData_result.autoRouting) {
            const { nearbyDonorsNotified, bloodBankForwarded } = responseData_result.autoRouting;
            
            // Show rejection modal with donor notification details
            setRejectionResponse({
              reason: responseData.message,
              nearbyDonorsNotified: nearbyDonorsNotified || 0,
              donorContactRequestsCreated: 0,
              notificationsSent: nearbyDonorsNotified || 0,
              bloodType: selectedRequest.blood_type,
              unitsRequested: selectedRequest.units_requested,
              hospitalName: selectedRequest.hospital_id?.name || 'Hospital'
            });

            setShowRejectionModal(true);
            setShowResponseModal(false);
          } else {
            // Non-emergency rejection
            success(`Request rejected successfully`);
            setShowResponseModal(false);
          }
        } else {
          // Accept response
          success(`Request accepted successfully`);
          setShowResponseModal(false);
        }

        // Close modal and refresh after a delay (to show modals first)
        setTimeout(() => {
          setSelectedRequest(null);
          setResponseData({ action: '', message: '' });
          fetchRequests();
        }, 500);
      } else {
        const data = await response.json();
        error(data.error || 'Failed to respond to request');
      }
    } catch (fetchError) {
      console.error('Error responding to request:', fetchError);
      error('Failed to respond to request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeStatusTab === 'pending') return req.status === 'pending';
    if (activeStatusTab === 'approved') return req.status === 'accepted';
    if (activeStatusTab === 'rejected') return req.status === 'rejected';
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="rounded-full h-32 w-32 border-b-2 border-[#ef4444]"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['bloodbank_admin']}>
      <div className="min-h-screen bg-[var(--background)] py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#ef4444]/10 rounded-lg">
                <Hospital className="h-8 w-8 text-[#ef4444]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                  Hospital Blood Requests
                </h1>
                <p className="text-[var(--text-secondary)] mt-1">
                  Review and respond to blood requests from hospitals (sorted by priority)
                </p>
              </div>
            </div>
          </div>

          {/* Status Tabs with Counters */}
          <div className="flex gap-2 mb-8 border-b border-[var(--border-color)] overflow-x-auto">
            {[
              { id: 'pending', label: '⏳ Pending', count: stats.pending, color: 'text-yellow-600 border-yellow-600' },
              { id: 'approved', label: '✅ Approved', count: stats.approved, color: 'text-green-600 border-green-600' },
              { id: 'rejected', label: '❌ Rejected', count: stats.rejected, color: 'text-red-600 border-red-600' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveStatusTab(tab.id)}
                className={`px-4 py-3 font-semibold text-sm md:text-base whitespace-nowrap transition-colors pb-2 border-b-2 ${
                  activeStatusTab === tab.id
                    ? `${tab.color}`
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
                <span className="ml-2 inline-block px-2.5 py-0.5 text-xs bg-[var(--background)] rounded-full font-bold">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
                <Hospital className="h-24 w-24 text-[var(--text-secondary)] opacity-50 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  {activeStatusTab === 'pending' && 'No Pending Requests'}
                  {activeStatusTab === 'approved' && 'No Approved Requests'}
                  {activeStatusTab === 'rejected' && 'No Rejected Requests'}
                </h3>
                <p className="text-[var(--text-secondary)]">
                  There are currently no {activeStatusTab} hospital requests.
                </p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <div key={request._id} className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Request Header with Info */}
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                      {/* Left: Hospital Name + Status */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="text-lg font-bold text-[var(--text-primary)]">
                            {request.hospital_id?.name || 'Unknown Hospital'}
                          </h3>
                          <StatusBadge status={request.status} size="sm" />
                          {request.urgency_level && (
                            <PriorityBadge urgency={request.urgency_level} size="sm" />
                          )}
                        </div>

                        {/* Quick Info Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <Droplet className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-[var(--text-secondary)]">Blood Type</p>
                              <p className="font-bold text-red-600">{request.blood_type}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0" />
                            <div>
                              <p className="text-xs text-[var(--text-secondary)]">Units</p>
                              <p className="font-bold text-[var(--text-primary)]">{request.units_requested}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0" />
                            <div>
                              <p className="text-xs text-[var(--text-secondary)]">Requested</p>
                              <p className="font-bold text-[var(--text-primary)]">
                                {new Date(request.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0" />
                            <div>
                              <p className="text-xs text-[var(--text-secondary)]">Hospital</p>
                              <p className="font-bold text-[var(--text-primary)]">
                                {request.hospital_id?.email ? request.hospital_id.email.split('@')[0] : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Request Type Alert */}
                        {request.request_type === 'emergency' && (
                          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                              🚨 EMERGENCY REQUEST - Requires immediate attention
                            </span>
                          </div>
                        )}

                        {/* Patient Details */}
                        {request.patient_details && (
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                            <p className="text-blue-900 dark:text-blue-100">
                              <strong>Patient:</strong> {request.patient_details.name} (Age: {request.patient_details.age})
                            </p>
                            <p className="text-blue-800 dark:text-blue-200 mt-1">
                              <strong>Condition:</strong> {request.patient_details.condition}
                            </p>
                          </div>
                        )}

                        {/* Response Message */}
                        {request.response_message && request.status !== 'pending' && (
                          <div className="mb-4 p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                            <p className="text-xs font-bold text-[var(--text-secondary)] mb-1">Your Response:</p>
                            <p className="text-sm text-[var(--text-primary)]">{request.response_message}</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Action Buttons */}
                      {request.status === 'pending' && (
                        <div className="flex gap-2 flex-wrap md:flex-col md:flex-nowrap flex-shrink-0 md:w-32">
                          <button
                            onClick={() => handleResponseRequest(request, 'accepted')}
                            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Approve</span>
                            <span className="sm:hidden">✅</span>
                          </button>
                          <button
                            onClick={() => handleResponseRequest(request, 'rejected')}
                            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Decline</span>
                            <span className="sm:hidden">❌</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info Card */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">📋 Request Management Tips</p>
                <ul className="space-y-1">
                  <li>✓ Requests are sorted by priority (CRITICAL before HIGH, etc.)</li>
                  <li>✓ Provide a detailed response message when approving or declining</li>
                  <li>✓ Emergency requests may trigger SOS alerts to nearby donors</li>
                  <li>✓ Real-time updates via Pusher - new requests appear instantly</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Response Modal */}
        <AcceptRequestModal
          isOpen={showDeliveryModal}
          onClose={() => {
            setShowDeliveryModal(false);
            setSelectedRequest(null);
          }}
          onConfirm={handleConfirmDelivery}
          request={selectedRequest}
          isLoading={isSubmitting}
        />

        {/* Rejection Response Modal */}
        {showResponseModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card-background)] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {responseData.action === 'accepted' ? '✅ Approve' : '❌ Decline'} Request
                </h3>
                <button
                  onClick={() => setShowResponseModal(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  ✕
                </button>
              </div>

              {/* Request Summary */}
              <div className="mb-6 p-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Hospital</p>
                    <p className="font-bold text-[var(--text-primary)]">{selectedRequest.hospital_id?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Blood Type</p>
                    <p className="font-bold text-red-600">{selectedRequest.blood_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Units Required</p>
                    <p className="font-bold text-[var(--text-primary)]">{selectedRequest.units_requested}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Priority</p>
                    <p className="font-bold"><PriorityBadge urgency={selectedRequest.urgency_level} size="sm" /></p>
                  </div>
                </div>
              </div>

              {/* Response Message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Response Message *
                </label>
                <textarea
                  value={responseData.message}
                  onChange={(e) => setResponseData({ ...responseData, message: e.target.value })}
                  className="w-full p-3 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                  rows="4"
                  placeholder={`Provide a reason for ${responseData.action === 'accepted' ? 'approving' : 'declining'} this request...`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitResponse}
                  className={`flex-1 py-2 px-4 rounded-lg text-white font-medium transition-colors ${
                    responseData.action === 'accepted' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {responseData.action === 'accepted' ? '✅ Approve' : '❌ Decline'} Request
                </button>
                <button
                  onClick={() => setShowResponseModal(false)}
                  className="flex-1 py-2 px-4 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Response Modal */}
        <RejectionResponseModal
          isOpen={showRejectionModal}
          onClose={() => setShowRejectionModal(false)}
          rejectionReason={rejectionResponse.reason}
          nearbyDonorsNotified={rejectionResponse.nearbyDonorsNotified}
          donorContactRequestsCreated={rejectionResponse.donorContactRequestsCreated}
          notificationsSent={rejectionResponse.notificationsSent}
          bloodType={rejectionResponse.bloodType}
          unitsRequested={rejectionResponse.unitsRequested}
          hospitalName={rejectionResponse.hospitalName}
        />
      </div>
    </ProtectedRoute>
  );
};

export default HospitalRequestAcceptance;
