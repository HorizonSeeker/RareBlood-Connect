"use client"
import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const currentRef = useRef(null);
  const newRef = useRef(null);
  const confirmRef = useRef(null);
  const MIN_PASSWORD_LENGTH = 6; // Minimum password length used for client-side validation

  if (!isOpen) return null;

  React.useEffect(() => {
    if (isOpen) console.log('ChangePasswordModal opened');
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('ChangePasswordModal submit clicked', { currentPassword, newPassword, confirmPassword });

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill out all password fields');
      // focus first empty
      if (!currentPassword) currentRef.current?.focus();
      else if (!newPassword) newRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters!`);
      newRef.current?.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Password confirmation does not match!');
      confirmRef.current?.focus();
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Processing...');
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      let payload = {};
      try {
        payload = await res.json();
      } catch (_) {
        const text = await res.text().catch(() => '');
        payload = { error: text || 'Unknown error' };
      }

      console.log('Change password response', res.status, payload);

      toast.dismiss(toastId);

      if (res.ok) {
        toast.success(payload.message || 'Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        // Map common status codes to user-friendly messages
        if (res.status === 401) {
          toast.error(payload.error || 'Unauthorized — please log in');
        } else if (res.status === 403) {
          toast.error(payload.error || 'Current password is incorrect!');
          currentRef.current?.focus();
        } else if (res.status === 400) {
          toast.error(payload.error || 'Invalid request');
        } else {
          toast.error(payload.error || `Failed to change password (${res.status})`);
        }
      }
    } catch (err) {
      console.error('Change password error:', err);
      toast.dismiss(toastId);
      toast.error('Server connection error. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[var(--card-background)] rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Change Password</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Current password</label>
            <input id="current-password-input" ref={currentRef} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border rounded" required aria-label="Current password" />
          </div>
          <div>
            <label className="block text-sm mb-1">New password</label>
            <input id="new-password-input" ref={newRef} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded" required aria-label="New password" />
            <p className="text-xs text-[var(--text-secondary)] mt-1">At least {MIN_PASSWORD_LENGTH} characters</p>
          </div>
          <div>
            <label className="block text-sm mb-1">Confirm new password</label>
            <input id="confirm-password-input" ref={confirmRef} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded" required aria-label="Confirm new password" />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-[#ef4444]'}`}>
              {loading ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
