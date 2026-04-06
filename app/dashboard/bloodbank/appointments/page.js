"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle, XCircle, Clock, Droplet, User, Mail, AlertCircle, Loader } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

const DonationAppointmentsPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, error: showError } = useToast();
  
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  // Redirect if not authenticated or not a bloodbank admin
  useEffect(() => {
    if (status === "unauthenticated") {
      showError("Please login first");
      router.push("/login");
    }
  }, [status, router, showError]);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/donation-appointments");
      
      if (!response.ok) {
        if (response.status === 401) {
          showError("You are not authorized to view this page");
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch appointments");
      }
      
      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      showError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [showError, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchAppointments();
    }
  }, [status, fetchAppointments]);

  // Filter appointments by status
  const filteredAppointments = appointments.filter(apt => {
    if (activeTab === 'pending') return apt.status === 'pending';
    if (activeTab === 'approved') return apt.status === 'approved';
    if (activeTab === 'history') return apt.status === 'completed' || apt.status === 'cancelled';
    return true;
  });

  // Handle appointment action
  const handleAction = async (appointment, newActionType) => {
    setSelectedAppointment(appointment);
    setActionType(newActionType);
    setActionReason('');
    setActionNotes('');
    setShowActionModal(true);
  };

  // Confirm action
  const confirmAction = async () => {
    if (!selectedAppointment || !actionType) return;

    // Validate inputs based on action type
    if (actionType === 'decline' && !actionReason.trim()) {
      showError("Please provide a reason for declining");
      return;
    }

    setActionLoading(true);
    try {
      const body = {
        cancellation_reason: actionReason,
        notes: actionNotes
      };

      const response = await fetch(
        `/api/donation-appointments/${selectedAppointment._id}?action=${actionType}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update appointment");
      }

      success(data.message);
      
      // Update local state
      setAppointments(prevAppointments =>
        prevAppointments.map(apt =>
          apt._id === selectedAppointment._id
            ? { ...apt, ...data.appointment }
            : apt
        )
      );

      setShowActionModal(false);
      setSelectedAppointment(null);

    } catch (err) {
      console.error("Error updating appointment:", err);
      showError(err.message || "Failed to update appointment");
    } finally {
      setActionLoading(false);
    }
  };

  // Format date to readable format
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get badge color based on status
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return '⏳ Pending';
      case 'approved':
        return '✅ Approved';
      case 'completed':
        return '🩸 Completed';
      case 'cancelled':
        return '❌ Cancelled';
      default:
        return status;
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <Loader className="h-12 w-12 text-[#ef4444] mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Loading appointments...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#ef4444]/10 rounded-lg">
              <Calendar className="h-8 w-8 text-[#ef4444]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
              Donation Appointments
            </h1>
          </div>
          <p className="text-[var(--text-secondary)]">
            Manage donor appointment requests for your blood bank
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[var(--border-color)] overflow-x-auto">
          {[
            { id: 'pending', label: '⏳ Pending', count: appointments.filter(a => a.status === 'pending').length },
            { id: 'approved', label: '✅ Approved', count: appointments.filter(a => a.status === 'approved').length },
            { id: 'history', label: '📋 History', count: appointments.filter(a => a.status === 'completed' || a.status === 'cancelled').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-semibold text-sm md:text-base whitespace-nowrap transition-colors pb-2 border-b-2 ${
                activeTab === tab.id
                  ? 'text-[#ef4444] border-[#ef4444]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
              <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-[var(--input-background)] rounded-full">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredAppointments.length === 0 ? (
          <div className="bg-[var(--card-background)] rounded-xl border border-[var(--border-color)] p-12 text-center">
            <AlertCircle className="h-12 w-12 text-[var(--text-secondary)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Appointments</h3>
            <p className="text-[var(--text-secondary)]">
              {activeTab === 'pending' && "No pending donation appointments at the moment."}
              {activeTab === 'approved' && "No approved appointments yet."}
              {activeTab === 'history' && "No completed or cancelled appointments."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredAppointments.map(appointment => (
              <div
                key={appointment._id}
                className="bg-[var(--card-background)] rounded-xl border border-[var(--border-color)] p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Appointment Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      {/* Blood Type Badge */}
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 bg-[#ef4444]/10 rounded-lg flex items-center justify-center">
                          <span className="text-2xl font-bold text-[#ef4444]">
                            {appointment.blood_type}
                          </span>
                        </div>
                      </div>

                      {/* Donor Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
                            {appointment.donor_name}
                          </h3>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}>
                            {getStatusLabel(appointment.status)}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{appointment.donor_email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span>{formatDate(appointment.appointment_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>{appointment.appointment_time}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cancellation Reason (if applicable) */}
                    {appointment.status === 'cancelled' && appointment.cancellation_reason && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                        <strong>Reason:</strong> {appointment.cancellation_reason}
                      </div>
                    )}

                    {/* Notes */}
                    {appointment.notes && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                        <strong>Notes:</strong> {appointment.notes}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap md:flex-col md:flex-nowrap md:ml-4">
                    {appointment.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAction(appointment, 'approve')}
                          className="flex-1 md:flex-none px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">Approve</span>
                          <span className="sm:hidden">✅</span>
                        </button>
                        <button
                          onClick={() => handleAction(appointment, 'decline')}
                          className="flex-1 md:flex-none px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">Decline</span>
                          <span className="sm:hidden">❌</span>
                        </button>
                      </>
                    )}

                    {appointment.status === 'approved' && (
                      <button
                        onClick={() => handleAction(appointment, 'complete')}
                        className="flex-1 md:flex-none px-4 py-2 bg-[#ef4444] hover:bg-[#ef4444]/90 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Droplet className="h-4 w-4" fill="currentColor" />
                        <span className="hidden sm:inline">Mark Completed</span>
                        <span className="sm:hidden">🩸</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-background)] rounded-xl shadow-xl max-w-md w-full p-6 border border-[var(--border-color)]">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
              {actionType === 'approve' && '✅ Approve Appointment'}
              {actionType === 'decline' && '❌ Decline Appointment'}
              {actionType === 'complete' && '🩸 Mark as Completed'}
            </h2>

            <div className="bg-[var(--input-background)] rounded-lg p-4 mb-6 text-sm">
              <p className="font-semibold text-[var(--text-primary)] mb-2">Donor: {selectedAppointment.donor_name}</p>
              <p className="text-[var(--text-secondary)]">
                {formatDate(selectedAppointment.appointment_date)} at {selectedAppointment.appointment_time}
              </p>
            </div>

            {/* Decline Reason */}
            {actionType === 'decline' && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Reason for Declining *
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., Staff unavailable, Blood bank closed that day, etc."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-background)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#ef4444]"
                  rows="3"
                />
              </div>
            )}

            {/* Notes (optional for approve and complete) */}
            {(actionType === 'approve' || actionType === 'complete') && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g., Donor in good health, no issues during donation, etc."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--input-background)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#ef4444]"
                  rows="3"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowActionModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] font-semibold hover:bg-[var(--input-background)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={actionLoading}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  actionType === 'decline'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#ef4444] hover:bg-[#ef4444]/90'
                }`}
              >
                {actionLoading ? (
                  <>
                    <Loader className="h-4 w-4" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionType === 'approve' && '✅ Approve'}
                    {actionType === 'decline' && '❌ Decline'}
                    {actionType === 'complete' && '🩸 Complete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default DonationAppointmentsPage;
