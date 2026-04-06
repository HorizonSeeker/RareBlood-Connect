"use client"
import React from 'react';
import { Droplet, Building2, Phone, MapPin, Calendar, AlertTriangle, Zap, CheckCircle, X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';

/**
 * BloodRequestCard Component
 * Displays a formatted blood request with all relevant information
 * 
 * Props:
 * - request: Blood request object from API
 * - onAction: Callback for action buttons (e.g., approve, decline, track)
 * - showActions: Boolean to show action buttons
 * - isNew: Boolean to highlight new requests with animation
 */
export const BloodRequestCard = ({ 
  request, 
  onAction = null, 
  showActions = false,
  isNew = false,
  isEmergency = false
}) => {
  if (!request) return null;

  // Determine emergency status
  const isEmergencyRequest = isEmergency || request.request_type === 'emergency' || !request.bloodbank_id;
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get hospital name or organization name
  const getOrganizationName = () => {
    if (request.hospital_name) return request.hospital_name;
    if (request.requested_by_hospital?.name) return request.requested_by_hospital.name;
    if (request.hospital_id?.name) return request.hospital_id.name;
    return 'Hospital';
  };

  return (
    <div className={`relative bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg overflow-hidden transition-all duration-300 ${
      isNew ? 'ring-2 ring-blue-400 dark:ring-blue-500 shadow-lg' : 'shadow-sm'
    } ${isEmergencyRequest ? 'border-l-4 border-l-red-500' : ''}`}>

      {/* New Request Badge */}
      {isNew && (
        <div className="absolute top-3 right-3">
          <span className="inline-block bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            🆕 NEW
          </span>
        </div>
      )}

      {/* Emergency Alert Banner */}
      {isEmergencyRequest && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 px-4 py-2 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-xs font-bold text-red-700 dark:text-red-300">🚨 EMERGENCY REQUEST</span>
        </div>
      )}

      {/* Card Content */}
      <div className="p-6 space-y-4">
        
        {/* Header: Blood Type, Units & Status Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
              <Droplet className="h-6 w-6 text-red-600 dark:text-red-400" fill="currentColor" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-red-600">{request.blood_type}</span>
                <span className="text-sm font-semibold text-[var(--text-secondary)] bg-[var(--background)] px-2 py-1 rounded">
                  {request.units_required} units
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Blood Type</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
            <StatusBadge status={request.status} size="md" />
            {request.urgency_level && (
              <PriorityBadge urgency={request.urgency_level} size="md" />
            )}
          </div>
        </div>

        {/* Hospital/Organization Info */}
        <div className="grid grid-cols-2 gap-4 py-3 border-y border-[var(--border-color)]">
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--text-secondary)]">Organization</p>
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{getOrganizationName()}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--text-secondary)]">Requested</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {formatDate(request.requested_date || request.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        {(request.emergency_contact_name || request.emergency_contact_mobile) && (
          <div className="bg-[var(--background)] rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Emergency Contact</p>
            {request.emergency_contact_name && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-primary)]">{request.emergency_contact_name}</span>
              </div>
            )}
            {request.emergency_contact_mobile && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0" />
                <a href={`tel:${request.emergency_contact_mobile}`} className="text-sm text-[#ef4444] hover:underline font-medium">
                  {request.emergency_contact_mobile}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Location Information */}
        {request.hospital_location && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[var(--text-secondary)]">{request.hospital_location}</p>
            </div>
          </div>
        )}

        {/* Request Details */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-2">Request Details</p>
          <div className="space-y-1">
            {request.emergency_details && (
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <span className="font-medium">Details:</span> {request.emergency_details}
              </p>
            )}
            {request.rejection_reason && request.status === 'REJECTED' && (
              <p className="text-sm text-red-700 dark:text-red-300">
                <span className="font-medium">Reason:</span> {request.rejection_reason}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && onAction && (
          <div className="flex gap-2 pt-4 border-t border-[var(--border-color)]">
            {request.status === 'IN_REVIEW' && (
              <>
                <button
                  onClick={() => onAction('approve', request)}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => onAction('decline', request)}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Decline
                </button>
              </>
            )}
            
            {request.status === 'IN_PROGRESS' && (
              <button
                onClick={() => onAction('view', request)}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="h-4 w-4" />
                View Details
              </button>
            )}
          </div>
        )}

        {/* Fulfillment Info */}
        {request.status === 'FULFILLED' && request.fulfilled_date && (
          <div className="text-xs text-center text-green-600 dark:text-green-400 font-semibold pt-2">
            ✅ Fulfilled on {formatDate(request.fulfilled_date)}
          </div>
        )}
      </div>
    </div>
  );
};

export default BloodRequestCard;
