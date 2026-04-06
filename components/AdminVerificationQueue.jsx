"use client"

import React from 'react';
import { useSession } from 'next-auth/react';
import { Building, MapPin, Mail, Phone, FileText, Eye, X, AlertCircle } from 'lucide-react';

const AdminVerificationQueue = () => {
  const { data: session, status } = useSession();
  const [pending, setPending] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState({});
  const [viewingLicense, setViewingLicense] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      setError("You must be logged in as an admin");
      setLoading(false);
      return;
    }

    const fetchPending = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("🔵 [AdminVerificationQueue] Session present, fetching hospitals...");
        const res = await fetch('/api/admin/hospitals/verify', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log("🔵 [AdminVerificationQueue] Response status:", res.status);
        const data = await res.json();
        console.log("🔵 [AdminVerificationQueue] Response:", data);
        
        if (!res.ok) {
          const errorMsg = data.error || `API error: ${res.status}`;
          console.error("❌ [AdminVerificationQueue]", errorMsg);
          setError(errorMsg);
          setPending([]);
          return;
        }
        
        setPending(data.pending || []);
        console.log("✅ [AdminVerificationQueue] Fetched successfully:", data.pending?.length || 0);
      } catch (err) {
        console.error('❌ [AdminVerificationQueue] Error:', err);
        setError(`Error: ${err.message}`);
        setPending([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [session, status]);

  const takeAction = async (id, action) => {
    if (!window.confirm(`Confirm ${action} for this hospital?`)) return;
    setProcessing(prev => ({ ...prev, [id]: true }));
    try {
      console.log("🔵 Sending verification action:", { id, action });
      const res = await fetch('/api/admin/hospitals/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profileId: id, action })
      });
      const result = await res.json();
      console.log("🔵 Action response:", result);
      
      if (res.ok) {
        // Remove from list on success
        setPending(prev => prev.filter(p => p._id !== id));
        console.log("✅ Hospital removed from pending list");
        alert(result.message || 'Action completed');
      } else {
        console.error("❌ Action failed:", result.error);
        alert(result.error || 'Failed to process action');
      }
    } catch (err) {
      console.error('❌ Action failed with error:', err);
      alert('Failed to process action');
    } finally {
      setProcessing(prev => ({ ...prev, [id]: false }));
    }
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-[200px] flex items-center justify-center"><div className="rounded-full h-8 w-8 border-b-2 border-[#ef4444]"></div></div>;
  }

  if (!session || session.user.role !== 'admin') {
    return <div className="text-sm text-[var(--text-secondary)]">You must be an admin to view this page.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Pending Hospital Verifications</h2>
        <p className="text-[var(--text-secondary)] text-sm mt-1">{pending.length} hospital(s) awaiting approval</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-900 dark:text-red-200 font-medium">Error</p>
            <p className="text-red-800 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="p-8 border-2 border-dashed border-[var(--border-color)] rounded-lg bg-[var(--card-background)] text-center">
          <p className="text-[var(--text-secondary)]">✓ All hospitals are verified!</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {[...pending].reverse().map(p => (
            <div key={p._id} className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Header with Hospital Name */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 border-b border-[var(--border-color)]">
                <div className="flex items-center space-x-3">
                  <Building className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-lg text-[var(--text-primary)]">{p.name}</h3>
                </div>
              </div>

              {/* Content Grid */}
              <div className="p-6 space-y-4">
                {/* Row 1: Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start space-x-3">
                    <Mail className="h-5 w-5 text-[#ef4444] mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Email</p>
                      <p className="text-[var(--text-primary)] break-all">{p.user_id?.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Phone className="h-5 w-5 text-[#ef4444] mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Contact</p>
                      <p className="text-[var(--text-primary)]">{p.contact_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Row 2: Address */}
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-[#ef4444] mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Address</p>
                    <p className="text-[var(--text-primary)]">{p.address || 'N/A'}</p>
                  </div>
                </div>

                {/* Row 3: Location Coordinates */}
                {(p.latitude || p.longitude) && (
                  <div className="bg-[var(--background)] rounded p-3 flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Location (GPS)</p>
                      <p className="text-[var(--text-primary)] text-sm font-mono">
                        {p.latitude?.toFixed(6)}, {p.longitude?.toFixed(6)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Row 4: License Document */}
                {p.hospital_license_url && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700 rounded p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-yellow-600" />
                      <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">Hospital License</span>
                    </div>
                    <button
                      onClick={() => setViewingLicense(p._id)}
                      className="flex items-center space-x-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View</span>
                    </button>
                  </div>
                )}

                {/* Row 5: Additional Documents */}
                {p.verification_documents && p.verification_documents.length > 0 && (
                  <div className="border-t border-[var(--border-color)] pt-4">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">Documents</p>
                    <div className="space-y-2">
                      {p.verification_documents.map((doc, i) => (
                        <a
                          key={i}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center space-x-2 p-2 bg-[var(--background)] rounded hover:bg-opacity-70 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-[#ef4444]" />
                          <span className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                            {doc.name || 'Document'}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="bg-[var(--background)] px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-end space-x-3">
                <button
                  disabled={processing[p._id]}
                  onClick={() => takeAction(p._id, 'reject')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
                <button
                  disabled={processing[p._id]}
                  onClick={() => takeAction(p._id, 'approve')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* License Preview Modal */}
      {viewingLicense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-background)] rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Hospital License</h3>
              <button
                onClick={() => setViewingLicense(null)}
                className="p-1 hover:bg-opacity-70 rounded transition-colors"
              >
                <X className="h-6 w-6 text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {pending.find(p => p._id === viewingLicense)?.hospital_license_url ? (
                <div className="space-y-4">
                  <img
                    src={pending.find(p => p._id === viewingLicense).hospital_license_url}
                    alt="Hospital License"
                    className="w-full rounded-lg border border-[var(--border-color)]"
                  />
                  <div className="flex items-center space-x-2">
                    <a
                      href={pending.find(p => p._id === viewingLicense).hospital_license_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-center transition-colors"
                    >
                      Open in New Tab
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--text-secondary)] text-center py-8">No license document available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerificationQueue;
