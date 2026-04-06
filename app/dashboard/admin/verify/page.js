"use client"
import React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AdminVerificationQueue from '@/components/AdminVerificationQueue';

const VerificationQueue = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user?.role !== 'admin') {
      console.error('❌ User is not admin, role:', session.user?.role);
      router.push('/unauthorized');
    }
  }, [session, status, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-full h-32 w-32 border-b-2 border-[#ef4444]"></div>
      </div>
    );
  }

  if (session.user?.role !== 'admin') {
    return null;
  }

  // Render the shared AdminVerificationQueue component
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Hospital Verification Queue</h1>
      <AdminVerificationQueue />
    </div>
  );
};

export default VerificationQueue;
