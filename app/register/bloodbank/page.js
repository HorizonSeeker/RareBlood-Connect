"use client"
import React from 'react';
import RegistrationForm from '@/components/form';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';

const BloodBankRegistrationPage = () => {
  const { data: session, status } = useSession();
  const { userRole, hasRole, isRegistrationComplete } = useUserRole();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'loading') return;

    // If not logged in, redirect to login
    if (!session) {
      router.push('/login');
      return;
    }

    // If user doesn't have bloodbank_admin role, redirect to register role selection
    if (hasRole && userRole !== 'bloodbank_admin') {
      router.push('/register');
      return;
    }

    // If user already completed registration, redirect to dashboard
    if (hasRole && isRegistrationComplete) {
      router.push('/dashboard/bloodbank');
      return;
    }
  }, [session, status, hasRole, userRole, isRegistrationComplete, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#ef4444]"></div>
      </div>
    );
  }

  return <RegistrationForm role="bloodbank_admin" />;
};

export default BloodBankRegistrationPage;
