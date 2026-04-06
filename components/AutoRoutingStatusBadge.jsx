"use client"
import React, { useState } from 'react';
import { AlertTriangle, Zap, Radio, X } from 'lucide-react';

/**
 * AutoRoutingStatusBadge Component
 * Displays pulsing alert when a request is in auto_routing status
 * Shows that system is auto-forwarding to other blood banks and broadcasting SOS
 * 
 * Props:
 * - sos_broadcasted: Object with SOS broadcast details
 * - sos_donor_details: Array of donors who were SOS notified
 * - forwarded_to: Array of forwarded blood banks
 * - blood_type: Blood type needed
 * - units_needed: Number of units
 * - responders: Array of donors who confirmed donation
 * - compact: Boolean - If true, shows tiny badge for table cells, expands on click
 * - onDetailClick: Callback when detail view is requested (for compact mode)
 */
export const AutoRoutingStatusBadge = ({ 
  sos_broadcasted, 
  sos_donor_details = [],
  forwarded_to, 
  blood_type, 
  units_needed,
  responders = [],
  compact = false,
  onDetailClick
}) => {
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 🔍 DEBUG: Log props
  React.useEffect(() => {
    console.log('🔴 [AutoRoutingStatusBadge] Props received:', {
      sos_broadcasted,
      sos_donor_details: sos_donor_details?.length > 0 ? sos_donor_details.map(d => ({ name: d.name, blood_type: d.blood_type })) : 'EMPTY',
      compact,
      responders: responders?.length
    });
  }, [sos_donor_details, responders]);

  // Compact Table Cell Display
  if (compact) {
    const respondersCount = responders?.length || 0;
    
    console.log('🟦 [AutoRoutingStatusBadge COMPACT] Rendering with:', {
      sos_donor_details_exists: !!sos_donor_details,
      sos_donor_details_length: sos_donor_details?.length,
      sos_donor_details_data: sos_donor_details
    });
    
    return (
      <>
        <div className="space-y-1.5">
          <button
            onClick={() => setShowDetailModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-md font-semibold text-xs transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 border border-orange-400 dark:border-orange-600"
            title="Click to view auto-routing details"
          >
            <span className="text-base">🚨</span>
            <span className="truncate">SOS Routing</span>
          </button>
          
          {/* Responders indicator */}
          {respondersCount > 0 && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-md text-xs font-medium">
              <span>✅</span>
              <span>{respondersCount} {respondersCount === 1 ? 'donor' : 'donors'} on the way</span>
            </div>
          )}

          {/* 🔗 NEW: SOS Donors List - Compact display */}
          {sos_donor_details && sos_donor_details.length > 0 && (
            <div className="inline-block px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium border border-blue-300 dark:border-blue-600">
              <span className="font-semibold">📋 Notified:</span> {sos_donor_details.map(d => d.name || 'Anonymous').join(', ')}
            </div>
          )}
        </div>

        {/* Detail Modal for Compact View */}
        {showDetailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-[var(--card-background)] rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="text-2xl">🚨</span>
                  Auto-Routing Status Details
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-[var(--text-secondary)]" />
                </button>
              </div>

              {/* Blood Type & Units Summary */}
              <div className="mb-4 p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {blood_type}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Blood Required</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{blood_type} - {units_needed} units</p>
                  </div>
                </div>
              </div>

              {/* SOS Broadcast Status */}
              {sos_broadcasted?.triggered && (
                <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-600 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Radio className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                        📢 SOS Broadcast Activated
                      </p>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        ✅ Notified <span className="font-bold text-red-600 dark:text-red-400">{sos_broadcasted.donors_notified ?? sos_broadcasted.donors_fcm_sent ?? 0}</span> donors within 10km radius
                      </p>
                      {sos_broadcasted.broadcasted_at && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                          📅 {new Date(sos_broadcasted.broadcasted_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 🔗 NEW: SOS Donors List - All notified donors */}
              {sos_donor_details && sos_donor_details.length > 0 && (
                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                    📋 SOS Donors Notified ({sos_donor_details.length})
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {sos_donor_details.map((donor, idx) => (
                      <div key={idx} className="p-2 bg-white dark:bg-[var(--background)] rounded border border-blue-200 dark:border-blue-700 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-medium text-blue-700 dark:text-blue-300">
                              {donor.name || 'Anonymous'}
                            </span>
                            <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                              {donor.blood_type} 🩸
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {donor.phone ? '📱' : ''}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Status: <span className="capitalize font-medium">{donor.response_status || 'pending'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forwarded Blood Banks */}
              {forwarded_to && forwarded_to.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Blood Banks Notified
                  </p>
                  <div className="space-y-2">
                    {forwarded_to.map((forward, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-[var(--background)] rounded border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold ${
                            forward.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
                            forward.status === 'accepted' ? 'text-green-600 dark:text-green-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {forward.status === 'pending' ? '⏳ Pending' :
                             forward.status === 'accepted' ? '✅ Accepted' :
                             '❌ Rejected'}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {new Date(forward.forwarded_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Bank ID: {forward.bloodbank_id?.toString().slice(-6)}
                        </p>
                        {forward.reason && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {forward.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Donor Responders */}
              {responders && responders.length > 0 && (
                <div className="mb-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-300 dark:border-emerald-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
                    ✅ Donors Confirmed ({responders.length})
                  </p>
                  <div className="space-y-2">
                    {responders.map((responder, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-[var(--background)] rounded border border-emerald-200 dark:border-emerald-700">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            {responder.donorId?.name || 'Anonymous Donor'}
                          </span>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            {new Date(responder.respondedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full mt-4 px-4 py-2 bg-[#ef4444] hover:bg-[#ef4444]/90 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Full Display (for detail modal or expanded view)
  return (
    <div className="w-full">
      {/* Main Alert Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-2 border-orange-400 dark:border-orange-600 rounded-lg p-4 shadow-lg">
        
        {/* Static Background (no animation) */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-200 to-transparent dark:via-orange-700 opacity-30"></div>
        
        {/* Content */}
        <div className="relative z-10">
          {/* Header with Alert Icon */}
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-red-500 rounded-lg flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-900 dark:text-orange-200 text-lg">
                ⚠️ Auto-Routing System Activated
              </h3>
              <p className="text-sm text-orange-800 dark:text-orange-300 mt-0.5">
                Auto-Routing & SOS Broadcasting Active
              </p>
            </div>
          </div>

          {/* Status Message */}
          <div className="bg-white/80 dark:bg-slate-800/80 rounded-lg p-3 mb-3 border border-orange-200 dark:border-orange-700">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              🏥 Primary blood bank has no stock. System is automatically routing to the nearest alternative blood bank and sending SOS signals to nearby donors to save the patient. 
              <br/>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block">
                ✓ Blood request {blood_type} ({units_needed} unit) is being processed...
              </span>
            </p>
          </div>

          {/* Broadcast Status */}
          {sos_broadcasted?.triggered && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-600 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    📢 SOS Signal Broadcasted
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    {(sos_broadcasted.donors_notified ?? sos_broadcasted.donors_fcm_sent ?? 0) > 0 
                      ? `✅ Notified ${sos_broadcasted.donors_notified ?? sos_broadcasted.donors_fcm_sent ?? 0} donors within 10km radius`
                      : '⏳ Broadcasting signal... Please wait'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Forwarded Banks Info */}
          {forwarded_to && forwarded_to.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                Blood Banks Notified:
              </p>
              <div className="space-y-1">
                {forwarded_to.map((forward, idx) => (
                  <div key={idx} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>
                      {forward.status === 'pending' ? '⏳ Pending' : forward.status === 'accepted' ? '✅' : '❌'} 
                      {' '} Blood Bank (ID: {forward.bloodbank_id?.toString().slice(-6)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Status - Static (no animation) */}
          <div className="mt-3 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-300 dark:border-orange-600">
            <p className="text-xs font-medium text-orange-800 dark:text-orange-300 text-center">
              ⏳ Auto-Routing in Progress...
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Help Text */}
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center">
        💡 System will continue searching until blood is provided. You will be notified with the results.
      </p>
    </div>
  );
};

export default AutoRoutingStatusBadge;
