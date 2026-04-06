'use client';

import React from 'react';
import { X, AlertCircle, Users, CheckCircle, Send } from 'lucide-react';

/**
 * RejectionResponseModal Component
 * 
 * Displays detailed information about request rejection and auto-routing activation:
 * - Number of donors notified via SOS
 * - Emergency auto-routing triggered message
 * - Donor details (count, blood types matched, etc.)
 */
export const RejectionResponseModal = ({
  isOpen,
  onClose,
  rejectionReason,
  nearbyDonorsNotified,
  donorContactRequestsCreated,
  notificationsSent,
  bloodType,
  unitsRequested,
  hospitalName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--card-background)] rounded-lg shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
              <AlertCircle className="h-6 w-6 text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Request Rejected</h2>
              <p className="text-xs text-[var(--text-secondary)]">Auto-routing activated</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--border-color)] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rejection Reason */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Rejection Reason</h3>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700">
              <p className="text-sm text-red-800 dark:text-red-200">{rejectionReason}</p>
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Blood Request Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Hospital</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{hospitalName || 'N/A'}</p>
              </div>
              <div className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Blood Type</p>
                <p className="text-sm font-semibold text-red-600">{bloodType}</p>
              </div>
              <div className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Units Requested</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{unitsRequested}</p>
              </div>
              <div className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Status</p>
                <p className="text-sm font-semibold text-orange-600">🚨 Auto-Routing</p>
              </div>
            </div>
          </div>

          {/* Auto-Routing Activation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Send className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Emergency Auto-Routing Activated
              </h3>
            </div>

            {/* Main Stats Box */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/20 rounded-lg border-2 border-orange-400 dark:border-orange-700 p-4">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Users className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                <div>
                  <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                    {nearbyDonorsNotified}
                  </div>
                  <p className="text-sm text-orange-600 dark:text-orange-400">Donors Notified</p>
                </div>
              </div>

              <p className="text-sm text-orange-700 dark:text-orange-200 text-center">
                SOS emergency alert has been sent to {nearbyDonorsNotified} compatible donors in the nearby area
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-300 dark:border-emerald-700">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">
                  Contact Requests Created
                </p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {donorContactRequestsCreated}
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-300 dark:border-blue-700">
                <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">
                  Notifications Sent
                </p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {notificationsSent}
                </p>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-700 dark:text-blue-300">
                ℹ️
              </span>
              What Happens Next?
            </h3>
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p>Donors receive push notification with request details</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p>Hospital is notified as donors accept the SOS request</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p>Hospital can track donor locations in real-time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-color)] p-4 bg-[var(--background)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectionResponseModal;
