"use client"
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const BloodBankRegistrationPage = () => {
  const router = useRouter();

  React.useEffect(() => {
    // Redirect back to main register page after a short delay
    const t = setTimeout(() => router.push('/register'), 1600);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="max-w-xl w-full bg-[var(--card-background)] p-8 rounded-xl border border-[var(--border-color)] text-center">
        <h2 className="text-xl font-semibold mb-4">Blood Bank registration is currently disabled</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">If you represent a blood bank, please contact the site administrator to request an account.</p>
        <Link href="/register" className="inline-block px-4 py-2 bg-[#ef4444] text-white rounded-md">Back to registration</Link>
      </div>
    </div>
  );
};

export default BloodBankRegistrationPage;
