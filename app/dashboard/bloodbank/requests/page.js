"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import usePusherRefresh from '@/hooks/usePusherRefresh';
import { TriangleAlert, Building2, Clock, CheckCircle, XCircle, User, Phone, MapPin, Calendar, MessageSquare } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

const BloodRequestsPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { success, error } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatusTab, setActiveStatusTab] = useState('pending');
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    rejected: 0,
    emergency: 0
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/requests', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
        
        const requestStats = {
          pending: data.requests.filter(r => r.status === 'pending').length,
          accepted: data.requests.filter(r => r.status === 'accepted').length,
          rejected: data.requests.filter(r => r.status === 'rejected').length,
          emergency: data.requests.filter(r => r.request_type === 'emergency').length
        };
        setStats(requestStats);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch requests:', errorData.error || response.statusText);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  usePusherRefresh(fetchRequests, 'blood-channel', 'new-alert');

  const handleAction = async (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setShowActionModal(true);
    setRejectionReason('');
  };

  const confirmAction = async () => {
    if (actionType === 'rejected' && !rejectionReason.trim()) {
      error('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          request_id: selectedRequest._id,
          status: actionType,
          rejection_reason: actionType === 'rejected' ? rejectionReason : null
        })
      });

      if (response.ok) {
        if (actionType === 'accepted') {
          success(`✅ Request accepted successfully! Contact details have been shared.`);
        } else if (actionType === 'rejected') {
          success(`❌ Request rejected. Reason has been sent to the requester.`);
        }
        setShowActionModal(false);
        fetchRequests();
      } else {
        const data = await response.json();
        error('Failed to update request: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating request:', err);
      error('Failed to update request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const baseClasses = "text-xs font-semibold px-3 py-1 rounded-full inline-block";
    switch (status) {
      case 'pending':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>⏳ Pending</span>;
      case 'accepted':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>✅ Approved</span>;
      case 'rejected':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>❌ Rejected</span>;
      case 'auto_routing':
        return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>🔄 Rejected & System Forwarded</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Unknown</span>;
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeStatusTab === 'pending') return req.status === 'pending';
    if (activeStatusTab === 'approved') return req.status === 'accepted';
    if (activeStatusTab === 'rejected') return req.status === 'rejected' || req.status === 'auto_routing';
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <TriangleAlert className="h-8 w-8 text-[#ef4444]" />
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">Blood Requests</h1>
            </div>
            <p className="text-[var(--text-secondary)]">
              {session?.user?.role === 'bloodbank_admin' 
                ? 'Manage incoming blood requests from hospitals and patients'
                : session?.user?.role === 'user'
                ? 'Track your blood request status'
                : 'View and manage your hospital\'s blood requests'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Pending Requests</p>
                  <p className="text-2xl font-bold text-[#ef4444]">{loading ? '...' : stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-[#ef4444]" />
              </div>
            </div>
            
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Accepted</p>
                  <p className="text-2xl font-bold text-green-600">{loading ? '...' : stats.accepted}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Emergency Requests</p>
                  <p className="text-2xl font-bold text-[#ef4444]">{loading ? '...' : stats.emergency}</p>
                </div>
                <TriangleAlert className="h-8 w-8 text-[#ef4444]" />
              </div>
            </div>
            
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Rejected & Auto-Routed</p>
                  <p className="text-2xl font-bold text-[#ef4444]">{loading ? '...' : (stats.rejected + (requests.filter(r => r.status === 'auto_routing').length))}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6 flex items-center">
              <TriangleAlert className="h-5 w-5 mr-2" />
              Blood Requests
            </h2>

            <div className="mb-6 flex border-b border-[var(--border-color)]">
              <button
                onClick={() => setActiveStatusTab('pending')}
                className={`px-6 py-3 font-medium transition-all border-b-2 ${
                  activeStatusTab === 'pending'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                ⏳ Pending ({stats.pending})
              </button>
              <button
                onClick={() => setActiveStatusTab('approved')}
                className={`px-6 py-3 font-medium transition-all border-b-2 ${
                  activeStatusTab === 'approved'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                ✅ Approved ({stats.accepted})
              </button>
              <button
                onClick={() => setActiveStatusTab('rejected')}
                className={`px-6 py-3 font-medium transition-all border-b-2 ${
                  activeStatusTab === 'rejected'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                ❌ Rejected ({stats.rejected})
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="rounded-full h-12 w-12 border-b-2 border-[#ef4444] mx-auto"></div>
                <p className="text-[var(--text-secondary)] mt-4">Loading requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12">
                <TriangleAlert className="h-16 w-16 text-[var(--text-secondary)] mx-auto mb-4 opacity-50" />
                <p className="text-[var(--text-secondary)] text-lg mb-2">
                  {activeStatusTab === 'pending' && 'No pending requests'}
                  {activeStatusTab === 'approved' && 'No approved requests'}
                  {activeStatusTab === 'rejected' && 'No rejected requests'}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {session?.user?.role === 'bloodbank_admin' 
                    ? 'Blood requests from hospitals will appear here'
                    : 'Your requests will appear here'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <div key={request._id} className="border border-[var(--border-color)] rounded-lg p-4 hover:bg-[var(--background)] transition-colors relative">
                    <div className="absolute top-4 right-4">
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="pr-32 mb-3">
                      <div className="flex items-center space-x-3">
                        {request.request_type === 'emergency' && (
                          <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded flex items-center space-x-1">
                            <TriangleAlert className="h-3 w-3" />
                            <span>EMERGENCY</span>
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-secondary)]">
                          {formatDate(request.requested_date)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-[var(--text-secondary)]" />
                        <div>
                          <p className="text-sm text-[var(--text-secondary)]">Patient</p>
                          <p className="font-medium text-[var(--text-primary)]">
                            {request.emergency_contact_name || request.requested_by_user?.name || 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-[var(--text-secondary)]" />
                        <div>
                          <p className="text-sm text-[var(--text-secondary)]">Contact</p>
                          <p className="font-medium text-[var(--text-primary)]">
                            {request.emergency_contact_mobile || request.requested_by_user?.mobile_number || 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-red-600"></div>
                        <div>
                          <p className="text-sm text-[var(--text-secondary)]">Blood Type</p>
                          <p className="font-medium text-[var(--text-primary)]">{request.blood_type} - {request.units_required} units</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-[var(--text-secondary)]" />
                        <div>
                          <p className="text-sm text-[var(--text-secondary)]">Location</p>
                          <p className="font-medium text-[var(--text-primary)]">{request.hospital_location || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {request.emergency_details && (
                      <div className="mb-4 p-3 bg-[var(--background)] rounded border border-[var(--border-color)]">
                        <p className="text-sm text-[var(--text-secondary)] mb-1">Emergency Details:</p>
                        <p className="text-[var(--text-primary)]">{request.emergency_details}</p>
                      </div>
                    )}

                    {request.status === 'accepted' && request.bloodbank_id && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm text-green-700 mb-2">✅ Request Accepted - Blood Bank Contact:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <p><strong>Name:</strong> {request.bloodbank_id.name}</p>
                          <p><strong>Phone:</strong> {request.bloodbank_id.contact_number || 'N/A'}</p>
                          <p><strong>Email:</strong> {request.bloodbank_id.email || 'N/A'}</p>
                          <p><strong>Address:</strong> {request.bloodbank_id.address || 'N/A'}</p>
                        </div>
                      </div>
                    )}

                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-700 mb-1">❌ Request Rejected:</p>
                        <p className="text-red-800">{request.rejection_reason}</p>
                      </div>
                    )}
                    {request.status === 'auto_routing' && (
                      <div className='mb-4 p-3 bg-orange-50 border border-orange-200 rounded'>
                        <div className='flex items-start gap-2'>
                          <span className='text-lg'>🔄</span>
                          <div>
                            <p className='text-sm font-semibold text-orange-700 mb-1'>Rejected & System Forwarded</p>
                            <p className='text-sm text-orange-600'>This emergency request has been automatically forwarded to the nearest alternative blood bank. The system is also broadcasting SOS signals to find volunteer donors.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {session?.user?.role === 'bloodbank_admin' && request.status === 'pending' && (
                      <div className="flex space-x-2 pt-4 border-t border-[var(--border-color)]">
                        <button
                          onClick={() => handleAction(request, 'accepted')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleAction(request, 'rejected')}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}

                    {request.status !== 'pending' && (
                      <div className="pt-4 border-t border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-secondary)] mb-2">
                          {request.status === 'accepted' ? '✅ Responded: Approved' : request.status === 'auto_routing' ? '🔄 System Auto-Forwarded' : '❌ Responded: Rejected'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showActionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {actionType === 'accepted' ? 'Accept Request' : 'Reject Request'}
              </h3>
              
              {actionType === 'rejected' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Reason for rejection (required):
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this request..."
                    className="w-full p-3 border border-[var(--border-color)] rounded-md focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                    rows={3}
                    required
                  />
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={confirmAction}
                  disabled={actionLoading || (actionType === 'rejected' && !rejectionReason.trim())}
                  className="bg-[#ef4444] hover:bg-[#ef4444]/90 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  {actionLoading ? 'Processing...' : `Confirm ${actionType === 'accepted' ? 'Accept' : 'Reject'}`}
                </button>
                <button
                  onClick={() => setShowActionModal(false)}
                  disabled={actionLoading}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
};

export default BloodRequestsPage;