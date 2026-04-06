"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Heart, Building2, Users, CheckCircle, AlertCircle } from 'lucide-react';

const AdminDashboard = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [counts, setCounts] = useState({ pendingHospitals: 0, pendingDonors: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Fetch verification counts
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'admin') return;

    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/admin/verification-counts');
        if (res.ok) {
          const data = await res.json();
          setCounts({
            pendingHospitals: data.pendingHospitals || 0,
            pendingDonors: data.pendingDonors || 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch verification counts:', error);
      } finally {
        setLoadingCounts(false);
      }
    };

    fetchCounts();
    // Refresh counts every 10 seconds
    const interval = setInterval(fetchCounts, 10000);
    return () => clearInterval(interval);
  }, [session, status]);

  React.useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'admin') {
      router.push('/');
    }
  }, [session, status, router]);

  if (status === 'loading' || !session) {
    return <div className="min-h-screen flex items-center justify-center"><div className="rounded-full h-32 w-32 border-b-2 border-[#ef4444]"></div></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background-color)] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Admin Dashboard</h1>
          <p className="text-[var(--text-secondary)]">Manage system verification and approvals</p>
        </div>

        {/* Admin Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Verify Hospital */}
          <div className="relative bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/admin/verify')}>
            {counts.pendingHospitals > 0 && (
              <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold animate-pulse">
                {counts.pendingHospitals}
              </div>
            )}
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-100 rounded-full p-3">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Verify Hospitals</h3>
                {counts.pendingHospitals > 0 && (
                  <p className="text-sm text-red-600 font-semibold">{counts.pendingHospitals} pending</p>
                )}
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Review and approve hospital registration requests
            </p>
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Go to Queue →
            </button>
          </div>

          {/* Verify Donors */}
          <div className="relative bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/admin/verify-donors')}>
            {counts.pendingDonors > 0 && (
              <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold animate-pulse">
                {counts.pendingDonors}
              </div>
            )}
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <Heart className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Verify Donors</h3>
                {counts.pendingDonors > 0 && (
                  <p className="text-sm text-red-600 font-semibold">{counts.pendingDonors} pending</p>
                )}
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Review and verify pending donor registrations
            </p>
            <button className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Go to Verification →
            </button>
          </div>

          {/* User Management */}
          <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/admin/users')}>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-green-100 rounded-full p-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">User Management</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Manage and monitor all system users
            </p>
            <button className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Go to Users →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
