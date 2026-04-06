"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Search, MessageSquare, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { BloodRequestCard } from '@/components/BloodRequestCard';
import { sortByPriority, formatRequestDate } from '@/lib/bloodRequestUtils';

// --- COMPONENT CHÍNH (Chứa logic cũ) ---
const TrackRequestContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { success, error } = useToast();
  
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState('email');
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [requestType, setRequestType] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusBreakdown, setStatusBreakdown] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Auto-load user's requests if authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      setSearchInput(session.user.email);
      setSearchType('email');
      autoSearchForUser(session.user.email);
    }
  }, [status, session]);

  const autoSearchForUser = async (email) => {
    setLoading(true);
    setNotFound(false);
    setRequest(null);
    setSearchResults([]);
    setAllResults([]);

    try {
      const response = await fetch(`/api/requests/track?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.requests && data.requests.length > 0) {
          setSearchResults(sortByPriority(data.requests));
          setAllResults(data.allRequests ? sortByPriority(data.allRequests) : []);
          setRequestType(data.type);
          setStatusMessage(data.message);
          setStatusBreakdown(data.breakdown || null);
        }
      } else if (response.status !== 401) {
        // Don't log 401 errors
        console.warn('[autoSearchForUser] Search failed:', response.status);
      }
    } catch (err) {
      console.error('Error auto-loading user requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchInput.trim()) {
      error('Please enter an email address or request ID');
      return;
    }

    setLoading(true);
    setNotFound(false);
    setRequest(null);
    setSearchResults([]);
    setAllResults([]);

    try {
      const response = await fetch(`/api/requests/track?${searchType}=${encodeURIComponent(searchInput.trim())}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (searchType === 'email') {
          if (data.requests && data.requests.length > 0) {
            setSearchResults(sortByPriority(data.requests));
            setAllResults(data.allRequests ? sortByPriority(data.allRequests) : []);
            setRequestType(data.type);
            setStatusMessage(data.message);
            setStatusBreakdown(data.breakdown || null);
            success(data.message);
          } else {
            setNotFound(true);
            error('No requests found for this email address');
          }
        } else {
          if (data.request) {
            setRequest(data.request);
            success('Request found successfully!');
          } else {
            setNotFound(true);
            error('No request found with the provided ID');
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        error(errorData.error || 'Failed to search for request');
        setNotFound(true);
      }
    } catch (err) {
      console.error('Error searching for request:', err);
      error('Failed to search for request. Please try again.');
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-4">
            Track Blood Request Status
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            Search for your blood requests by email or request ID
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-[var(--card-background)] rounded-lg shadow-sm border border-[var(--border-color)] p-6 mb-8">
          
          {/* User Info for Authenticated Users */}
          {status === 'authenticated' && session?.user?.email && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">💡 Tip:</span> Showing your requests for {session.user.email}. 
              </p>
            </div>
          )}
          
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Search Type Toggle */}
            <div className="flex space-x-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="email"
                  checked={searchType === 'email'}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">Search by Email</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="id"
                  checked={searchType === 'id'}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">Search by Request ID</span>
              </label>
            </div>

            {/* Search Input */}
            <div className="flex gap-3">
              <input
                type={searchType === 'email' ? 'email' : 'text'}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={searchType === 'email' ? 'Enter your email address' : 'Enter your request ID'}
                className="flex-1 px-4 py-3 border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-[#ef4444] focus:border-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-[#ef4444] text-white rounded-lg hover:bg-[#ef4444]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Single Request Detail */}
        {request && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Your Request Details</h2>
            <BloodRequestCard request={request} />
          </div>
        )}

        {/* Multiple Requests Results */}
        {searchResults.length > 0 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-[var(--card-background)] rounded-lg shadow-sm border border-[var(--border-color)] p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {requestType === 'fulfilled' ? '✅ Fulfilled Requests' : requestType === 'active' ? '⏳ Active Requests' : '📋 All Requests'}
                </h2>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  requestType === 'fulfilled' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                    : requestType === 'active'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                }`}>
                  {searchResults.length} requests
                </div>
              </div>
              {statusMessage && (
                <p className="text-[var(--text-secondary)] mb-3">{statusMessage}</p>
              )}
              
              {/* Status Breakdown */}
              {statusBreakdown && (
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {statusBreakdown.accepted > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                      <p className="text-green-700 dark:text-green-400 font-semibold">{statusBreakdown.accepted}</p>
                      <p className="text-green-600 dark:text-green-300">Accepted</p>
                    </div>
                  )}
                  {statusBreakdown.active > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                      <p className="text-yellow-700 dark:text-yellow-400 font-semibold">{statusBreakdown.active}</p>
                      <p className="text-yellow-600 dark:text-yellow-300">Active</p>
                    </div>
                  )}
                  {statusBreakdown.completed > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-blue-700 dark:text-blue-400 font-semibold">{statusBreakdown.completed}</p>
                      <p className="text-blue-600 dark:text-blue-300">Completed</p>
                    </div>
                  )}
                  {statusBreakdown.rejected > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
                      <p className="text-red-700 dark:text-red-400 font-semibold">{statusBreakdown.rejected}</p>
                      <p className="text-red-600 dark:text-red-300">Rejected</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Request Cards */}
            <div className="space-y-4">
              {searchResults.map((req) => (
                <BloodRequestCard
                  key={req._id}
                  request={req}
                />
              ))}
            </div>

            {/* Show all requests link if not already showing all */}
            {allResults.length > searchResults.length && (
              <details className="bg-[var(--card-background)] rounded-lg shadow-sm border border-[var(--border-color)] p-6">
                <summary className="cursor-pointer font-semibold text-[var(--text-primary)] hover:text-[#ef4444]">
                  📌 Show all {allResults.length} requests (including rejected/completed)
                </summary>
                <div className="mt-4 space-y-4 pt-4 border-t border-[var(--border-color)]">
                  {allResults.map((req) => (
                    <BloodRequestCard
                      key={req._id}
                      request={req}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Not Found Message */}
        {notFound && !loading && (
          <div className="bg-[var(--card-background)] rounded-lg shadow-sm border border-[var(--border-color)] p-8 text-center">
            <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Request Not Found</h3>
            <p className="text-[var(--text-secondary)] mb-4">
              We couldn't find a request with the provided {searchType === 'email' ? 'email address' : 'request ID'}.
            </p>
            <div className="text-sm text-[var(--text-secondary)] space-y-1">
              <p>• Make sure you entered the correct information</p>
              <p>• Try using the other search method</p>
              <p>• Contact support if you continue having issues</p>
            </div>
          </div>
        )}

        {/* Information Card */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📍 How to Track Your Request</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>✓ Enter any email address used when making a request</li>
                <li>✓ Or enter any request ID to see its detailed status</li>
                <li>✓ Track any request - no login required</li>
                <li>✓ See pending status, approval details, or rejection reasons</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT WRAPPER (Wrap Suspense to fix build issue) ---
const TrackRequestPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-[#ef4444] border-t-transparent rounded-full mb-2"></div>
          <p className="text-[var(--text-secondary)]">Loading track page...</p>
        </div>
      </div>
    }>
      <TrackRequestContent />
    </Suspense>
  );
};

export default TrackRequestPage;