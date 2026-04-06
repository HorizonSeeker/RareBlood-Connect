import { useState } from 'react';
import { useToast } from '@/context/ToastContext';

/**
 * Hook for Donor to confirm emergency donation
 * Usage: const { confirmDonation, confirming, confirmed } = useEmergencyConfirm();
 */
export const useEmergencyConfirm = () => {
  const { success, error } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);

  /**
   * Confirm donation for an emergency request
   * @param {string} requestId - The emergency request ID
   * @param {number} unitsOffered - Number of units donor will donate (default: 1)
   * @returns {Promise<object>} Response data with confirmation details
   */
  const confirmDonation = async (requestId, unitsOffered = 1) => {
    if (!requestId) {
      error('❌ Request ID is missing');
      return null;
    }

    setConfirming(true);
    try {
      const response = await fetch(`/api/emergency/${requestId}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          unitsOffered: parseInt(unitsOffered)
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Donation confirmed:', data);
        
        setConfirmed(true);
        setConfirmationData(data);
        
        // Show success message
        success(
          `✅ Donation Confirmed!\n` +
          `You confirmed to donate ${unitsOffered} unit(s) of ${data.request?.blood_type} blood.\n` +
          `Status: ${data.request?.status === 'resolved' ? '✅ Request Fulfilled' : `In Progress: ${Math.round(data.progressPercentage)}%`}`
        );
        
        return data;
      } else {
        const data = await response.json();
        
        // Check if already confirmed
        if (data.warning) {
          error(`⚠️ ${data.warning}`);
          return data;
        }
        
        error(`❌ Failed to confirm: ${data.error || 'Unknown error'}`);
        return null;
      }
    } catch (err) {
      console.error('Error confirming donation:', err);
      error('❌ Failed to confirm donation. Please try again.');
      return null;
    } finally {
      setConfirming(false);
    }
  };

  /**
   * Reset confirmation state
   */
  const resetConfirmation = () => {
    setConfirmed(false);
    setConfirmationData(null);
  };

  return {
    confirmDonation,
    confirming,
    confirmed,
    confirmationData,
    resetConfirmation
  };
};

export default useEmergencyConfirm;
