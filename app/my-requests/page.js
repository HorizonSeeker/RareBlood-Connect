"use client"
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { TriangleAlert, Clock, CheckCircle, XCircle, User, Phone, MapPin, Building2, AlertCircle } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { sortByPriority, isEmergencyRequest, formatRequestDate, isRecentRequest } from '@/lib/bloodRequestUtils';

const UserRequestsPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { success, error } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'completed'

  useEffect(() => {
    fetchUserRequests();
  }, []);

  const fetchUserRequests = async () => {
    try {
      setLoading(true);
      
      if (!session?.user) {
        console.warn('[fetchUserRequests] User not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/requests', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (response.status === 401) {
        console.warn('[fetchUserRequests] Session expired');
        error('Session expired. Please login again.');
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const sortedRequests = sortByPriority(data.requests || []);
        setRequests(sortedRequests);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch user requests:', errorData.error || response.statusText);
        // Don't show error toast - just log it
      }
    } catch (error) {
      console.error('Error fetching user requests:', error);
      // Don't show error toast for network errors - they'll resolve automatically
    } finally {
      setLoading(false);
    }
  };

  // Filter requests based on active tab
  const getFilteredRequests = () => {
    const activeStatuses = ['IN_REVIEW', 'IN_PROGRESS', 'APPROVED', 'PARTIAL_APPROVED'];
    const completedStatuses = ['FULFILLED', 'REJECTED', 'CANCELLED'];

    if (activeTab === 'active') {
      return requests.filter(req => {
        const status = req.status?.toUpperCase();
        return activeStatuses.includes(status);
      });
    } else if (activeTab === 'completed') {
      return requests.filter(req => {
        const status = req.status?.toUpperCase();
        return completedStatuses.includes(status);
      });
    }
    return requests;
  };

  const filteredRequests = getFilteredRequests();
  const tabCounts = {
    all: requests.length,
    active: requests.filter(r => ['IN_REVIEW', 'IN_PROGRESS', 'APPROVED', 'PARTIAL_APPROVED'].includes(r.status?.toUpperCase())).length,
    completed: requests.filter(r => ['FULFILLED', 'REJECTED', 'CANCELLED'].includes(r.status?.toUpperCase())).length
  };

  return (
    <ProtectedRoute allowedRoles={['user']}>
      <div className="min-h-screen bg-[var(--background)] py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <TriangleAlert className="h-8 w-8 text-[#ef4444]" />
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">My Blood Requests</h1>
            </div>
            <p className="text-[var(--text-secondary)]">
              Track the status of your blood requests in priority order
            </p>
          </div>



          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-[var(--border-color)]">
            {[
              { id: 'all', label: 'All Requests', icon: '📋' },
              { id: 'active', label: 'Active', icon: '⚡' },
              { id: 'completed', label: 'Completed', icon: '✅' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-semibold text-sm transition-colors pb-2 border-b-2 ${
                  activeTab === tab.id
                    ? 'text-[#ef4444] border-[#ef4444]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                <span className="ml-2 text-xs bg-[var(--background)] rounded-full px-2 py-0.5">
                  {tabCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Requests List */}
          <div>
            {loading ? (
              <div className="text-center py-12">
                <div className="rounded-full h-12 w-12 border-b-2 border-[#ef4444] mx-auto"></div>
                <p className="text-[var(--text-secondary)] mt-4">Loading your requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
                <User className="h-16 w-16 text-[var(--text-secondary)] mx-auto mb-4 opacity-50" />
                <p className="text-[var(--text-secondary)] text-lg mb-2">
                  {activeTab === 'all' ? 'No requests found' : `No ${activeTab} requests`}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {activeTab === 'all' && "You haven't submitted any blood requests yet"}
                  {activeTab === 'active' && "All your requests have been completed"}
                  {activeTab === 'completed' && "You don't have any completed requests"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => {
                  const isNew = isRecentRequest(request, 5); // Highlight if created in last 5 minutes
                  return (
                    <BloodRequestCard
                      key={request._id}
                      request={request}
                      isNew={isNew}
                      isEmergency={isEmergencyRequest(request)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">💡 Requests are sorted by priority</p>
                <p>CRITICAL requests appear first, followed by HIGH, MEDIUM, and LOW priority requests.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default UserRequestsPage;
