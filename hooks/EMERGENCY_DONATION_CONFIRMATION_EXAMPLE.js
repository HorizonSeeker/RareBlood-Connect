/**
 * Example Component: Emergency Donation Confirmation
 * 
 * How to use in Donor's Emergency Notification Component:
 * 
 * import useEmergencyConfirm from '@/hooks/useEmergencyConfirm';
 * 
 * export default function EmergencyDonationPrompt({ requestId, bloodType, unitsNeeded }) {
 *   const { confirmDonation, confirming, confirmed } = useEmergencyConfirm();
 *   
 *   const handleConfirmDonation = async () => {
 *     const result = await confirmDonation(requestId, 1);
 *     if (result?.confirmed) {
 *       // Show success state
 *       // {result.progressPercentage}% fulfilled
 *       // {result.confirmed_donors_count} donors confirmed
 *     }
 *   };
 *   
 *   return (
 *     <div className="bg-red-50 p-4 rounded-lg border-2 border-red-400">
 *       <h3 className="text-lg font-bold text-red-600">🚨 Emergency Blood Needed!</h3>
 *       <p>Blood Type: {bloodType}</p>
 *       <p>Units Needed: {unitsNeeded}</p>
 *       
 *       <button
 *         onClick={handleConfirmDonation}
 *         disabled={confirming}
 *         className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold"
 *       >
 *         {confirming ? '⏳ Confirming...' : '✅ I am on my way!'}
 *       </button>
 *     </div>
 *   );
 * }
 */

// This is a documentation file. Implementation depends on where Emergency Notifications are displayed.
// Common locations:
// 1. Dashboard Donor Page (/app/dashboard/donor/page.js) - In incoming emergency requests section
// 2. FCM Notification Handler - When FCM message is received
// 3. Emergency Request Notification Modal - Custom notification component

export const EMERGENCY_DONATION_IMPLEMENTATION = {
  hook: 'useEmergencyConfirm',
  endpoint: 'PATCH /api/emergency/[requestId]/confirm',
  requestBody: {
    unitsOffered: 1 // number of units donor will donate
  },
  responseModel: {
    success: true,
    message: 'string',
    confirmed: true,
    donor: {
      id: 'ObjectId',
      name: 'string',
      bloodType: 'string'
    },
    request: {
      id: 'ObjectId',
      blood_type: 'string',
      units_required: 'number',
      units_fulfilled: 'number',
      status: 'active | resolved',
      confirmed_donors_count: 'number',
      hospital_location: 'string'
    },
    progressPercentage: 'number (0-100)'
  }
};
