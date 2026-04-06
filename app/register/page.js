"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { Heart, Lock, Mail } from "lucide-react";
import RegistrationForm from "@/components/form";

const RegisterPage = () => {
  const [role, setRole] = useState('user');
  const [signupData, setSignupData] = useState({ email: '', password: '' });
  const [signupLoading, setSignupLoading] = useState(false);
  const router = useRouter();
  const { data: session, status, update } = useSession();

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="rounded-full h-32 w-32 border-b-2 border-[#ef4444]"></div>
      </div>
    );
  }

  // If authenticated, show registration form
  if (status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="w-full max-w-2xl bg-[var(--card-background)] p-8 rounded-xl shadow-md border border-[var(--border-color)]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className="h-8 w-8 text-[#ef4444]" fill="currentColor" />
              <h1 className="text-2xl font-bold text-[#ef4444]">BloodBond</h1>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Complete Your Profile</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Join us to save lives</p>
          </div>

          {/* Role Tabs */}
          <div className="flex gap-2 justify-center mb-6">
            {['user','hospital'].map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${role === r ? 'bg-[#ef4444] text-white' : 'bg-[var(--input-background)] text-[var(--text-primary)] border border-[var(--border-color)]'}`}>
                {r === 'user' ? 'Donor' : 'Hospital'}
              </button>
            ))}
          </div>

          {/* Render role-specific registration form */}
          <RegistrationForm role={role} session={session} />

          <div className="mt-6 text-center text-sm">
            <p className="text-[var(--text-secondary)]">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-[#ef4444] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, show signup form first
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="w-full max-w-2xl bg-[var(--card-background)] p-8 rounded-xl shadow-md border border-[var(--border-color)]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className="h-8 w-8 text-[#ef4444]" fill="currentColor" />
              <h1 className="text-2xl font-bold text-[#ef4444]">RareBlood Connect</h1>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Create Account</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Sign up to get started</p>
          </div>

          {/* Signup Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSignupLoading(true);
              try {
                // Step 1: Create account via API
                console.log('🔵 Step 1: Creating account...');
                const signupResponse = await fetch('/api/auth/signup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(signupData),
                });

                const signupResult = await signupResponse.json();

                if (!signupResponse.ok) {
                  alert(signupResult.error || 'Signup failed');
                  setSignupLoading(false);
                  return;
                }

                console.log('✅ Step 1: Account created');
                
                // Step 2: Immediately sign in using NextAuth
                console.log('🔵 Step 2: Signing in with NextAuth...');
                const signInResult = await signIn('credentials', {
                  email: signupData.email,
                  password: signupData.password,
                  redirect: false,
                });

                if (signInResult?.error) {
                  console.error('❌ Sign in failed:', signInResult.error);
                  alert('Account created! Please login with your credentials.');
                  setSignupLoading(false);
                  return;
                }

                console.log('✅ Step 2: Signed in successfully');
                
                // Step 3: Set the role for the user
                console.log('🔵 Step 3: Setting user role...');
                const setRoleResponse = await fetch('/api/auth/set-role', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ role }),
                });

                if (!setRoleResponse.ok) {
                  console.error('❌ Failed to set role');
                  alert('Failed to set role. Please try again.');
                  return;
                }

                console.log('✅ Step 3: User role set successfully');
                
                // Step 4: Trigger session update to refresh JWT with new role
                console.log('🔵 Step 4: Updating session...');
                await update();
                console.log('✅ Step 4: Session updated with new role');
                
                // Step 5: Component will re-render with updated session showing profile form
                console.log('🔵 Step 5: Waiting for component re-render...');

              } catch (error) {
                console.error('❌ Signup/SignIn error:', error);
                alert('Error during signup: ' + error.message);
                setSignupLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                <Mail className="inline w-4 h-4 mr-2" />
                Email *
              </label>
              <input
                type="email"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                required
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                <Lock className="inline w-4 h-4 mr-2" />
                Password *
              </label>
              <input
                type="password"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                required
                minLength="6"
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
                placeholder="At least 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={signupLoading}
              className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
                signupLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#ef4444] hover:bg-[#ef4444]/90'
              }`}
            >
              {signupLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-[var(--text-secondary)]">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-[#ef4444] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default RegisterPage;