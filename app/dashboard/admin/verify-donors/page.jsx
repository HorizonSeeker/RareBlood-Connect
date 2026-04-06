"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Heart, AlertCircle, CheckCircle, XCircle, LoaderCircle, Eye, Phone, AlertTriangle, MapPin, User, Mail, FileText, Droplet } from "lucide-react";
import { toast } from "react-toastify";

const VerifyDonors = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState(null);

  // Check authorization
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/unauthorized");
    }
  }, [status, session, router]);

  // Fetch pending donors
  useEffect(() => {
    const fetchDonors = async () => {
      setError(null);
      try {
        console.log("🔵 [VerifyDonors] Fetching pending donors...");
        const response = await fetch("/api/donors/pending", {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();
        console.log("🔵 [VerifyDonors] Response status:", response.status, data);

        if (response.ok) {
          setDonors(data.donors || []);
          console.log("✅ [VerifyDonors] Donors loaded:", data.donors?.length || 0);
        } else {
          const errorMsg = data.error || `Failed to fetch donors (${response.status})`;
          console.error("❌ [VerifyDonors] Failed:", errorMsg);
          setError(errorMsg);
          setDonors([]);
          toast.error(errorMsg);
        }
      } catch (error) {
        const errorMsg = `Error: ${error.message}`;
        console.error("❌ [VerifyDonors] Catch error:", error);
        setError(errorMsg);
        setDonors([]);
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated" && session?.user?.role === "admin") {
      fetchDonors();
      // Auto-refresh every 5 seconds to show new pending donors in real-time
      const interval = setInterval(fetchDonors, 5000);
      return () => clearInterval(interval);
    }
  }, [status, session]);

  const handleVerifyDonor = async (donorId, action) => {
    setVerifying((prev) => ({ ...prev, [donorId]: true }));
    try {
      console.log("🔵 Verifying donor:", { donorId, action });
      const response = await fetch("/api/donors/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ donorId, action }),
      });

      const data = await response.json();
      console.log("🔵 Verification response:", data);

      if (response.ok) {
        toast.success(`Donor ${action === "approve" ? "approved" : "rejected"} successfully`);
        // Remove donor from list
        setDonors((prev) => prev.filter((d) => d._id !== donorId));
      } else {
        console.error("❌ Verification failed:", data.error);
        toast.error(data.error || "Verification failed");
      }
    } catch (error) {
      console.error("❌ Error verifying donor:", error);
      toast.error("Error verifying donor");
    } finally {
      setVerifying((prev) => ({ ...prev, [donorId]: false }));
    }
  };

  // Handle ESC key to close image modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedImage) {
        setSelectedImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage]);

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoaderCircle className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (status === "unauthenticated" || session?.user?.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background-color)] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-red-500" />
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              Donor Verification
            </h1>
          </div>
          <p className="text-[var(--text-secondary)]">
            Review and verify pending donor registrations
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {donors.length} donor{donors.length !== 1 ? 's' : ''} awaiting verification
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-900 dark:text-red-200 font-medium">Error Loading Donors</p>
              <p className="text-red-800 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* No Donors Message */}
        {donors.length === 0 && !error && (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
            <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-300 mb-2">
              All caught up!
            </h3>
            <p className="text-blue-700 dark:text-blue-400">
              All pending donor verifications have been processed.
            </p>
          </div>
        )}

        {/* Donors Grid */}
        {donors.length > 0 && (
          <div className="space-y-6">
            {donors.map((donor) => (
              <div
                key={donor._id}
                className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header with Donor Name and Blood Type Badge */}
                <div className="bg-gradient-to-r from-red-50 to-pink-100 dark:from-red-900/20 dark:to-pink-900/20 p-4 border-b border-[var(--border-color)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Droplet className="h-6 w-6 text-red-600 dark:text-red-400" />
                      <div>
                        <h3 className="font-bold text-lg text-[var(--text-primary)]">
                          {donor.user_id?.name || "Unknown Donor"}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {donor.user_id?.email || "No email"}
                        </p>
                      </div>
                    </div>
                    <span className="inline-block bg-red-600 text-white px-4 py-2 rounded-full text-lg font-bold">
                      {donor.blood_type || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Content Grid */}
                <div className="p-6 space-y-4">
                  {/* Row 1: Basic Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-3">
                      <User className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Age / Gender</p>
                        <p className="text-[var(--text-primary)]">
                          {donor.age || "N/A"} years • {donor.gender || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Phone className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Mobile</p>
                        <p className="text-[var(--text-primary)]">{donor.mobile_number || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Address */}
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Address</p>
                      <p className="text-[var(--text-primary)]">{donor.address || "N/A"}</p>
                    </div>
                  </div>

                  {/* Row 3: Health Info */}
                  <div className="bg-[var(--background)] rounded p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Weight</span>
                      <span className="text-[var(--text-primary)] font-medium">{donor.weight || "N/A"} kg</span>
                    </div>
                    {donor.emergency_contact_mobile && (
                      <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-2">
                        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Emergency Contact</span>
                        <span className="text-[var(--text-primary)] font-medium">{donor.emergency_contact_mobile}</span>
                      </div>
                    )}
                  </div>

                  {/* Row 4: Medical Proof */}
                  {donor.medicalProofUrl && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700 rounded p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                        <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">Medical Proof / Blood Test</span>
                      </div>
                      <button
                        onClick={() => setSelectedImage(donor.medicalProofUrl)}
                        className="flex items-center gap-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Document
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="bg-[var(--background)] px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3">
                  <button
                    onClick={() => handleVerifyDonor(donor._id, "reject")}
                    disabled={verifying[donor._id]}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {verifying[donor._id] ? (
                      <>
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Reject
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleVerifyDonor(donor._id, "approve")}
                    disabled={verifying[donor._id]}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {verifying[donor._id] ? (
                      <>
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Medical Proof Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="bg-[var(--card-background)] rounded-lg overflow-hidden shadow-2xl max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-50 to-pink-100 dark:from-red-900/20 dark:to-pink-900/20 p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Medical Proof / Blood Test Document</h3>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6 text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/5 dark:bg-black/30">
              <img
                src={selectedImage}
                alt="Medical Proof"
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>

            {/* Modal Footer */}
            <div className="bg-[var(--background)] p-4 border-t border-[var(--border-color)] flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Press ESC or click outside to close</p>
              <a
                href={selectedImage}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
              >
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyDonors;
