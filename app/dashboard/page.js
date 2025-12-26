"use client"
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Heart, CheckCircle } from 'lucide-react';

// Lazy load Map (no SSR)
const MapWithNoSSR = dynamic(() => import('@/components/Map'), { 
  ssr: false,
  loading: () => <p className="text-center p-4">Đang tải bản đồ...</p>
});

const DashboardPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [donors, setDonors] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  // Lấy dữ liệu donors cho bản đồ (nếu API trả 401 thì component sẽ chỉ không hiển thị markers)
  useEffect(() => {
    async function fetchDonors() {
      try {
        const res = await fetch('/api/donors');
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Unknown error' }));
          console.error('Failed to fetch donors', err);
          setMapLoading(false);
          return;
        }
        const data = await res.json();
        setDonors(data.donors || []);
      } catch (err) {
        console.error('Error loading donors for map:', err);
      } finally {
        setMapLoading(false);
      }
    }
    fetchDonors();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#ef4444]"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4 sm:p-6">
      <div className="w-full max-w-md space-y-8 bg-[var(--card-background)] p-6 sm:p-8 rounded-xl shadow-md border border-[var(--border-color)] transition-colors duration-200 text-center">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <Heart className="h-8 w-8 text-[#ef4444]" aria-hidden="true" />
            <h1 className="font-heading text-3xl font-bold text-[#ef4444]">BloodBond</h1>
          </div>
          
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Registration Successful!
          </h2>
          <p className="text-[var(--text-secondary)] mb-6">
            Welcome to BloodBond, {session.user?.name || session.user?.email}! 
            Your account has been created successfully.
          </p>
          
          <div className="space-y-4">
            <button 
              onClick={() => router.push('/')}
              className="w-full py-3 px-4 rounded-md bg-[#ef4444] hover:bg-[#ef4444]/90 text-white font-medium transition-colors"
            >
              Go to Home
            </button>
            
            <p className="text-sm text-[var(--text-secondary)]">
              You can now access all BloodBond features based on your role.
            </p>

            {/* Bản đồ người hiến máu */}
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Bản đồ vị trí người hiến máu</h3>
              <div className="border-2 border-gray-200 rounded-xl">
                <MapWithNoSSR donors={donors} />
              </div>
              <p className="mt-2 text-sm text-gray-600">* Dữ liệu vị trí từ API <code>/api/donors</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
