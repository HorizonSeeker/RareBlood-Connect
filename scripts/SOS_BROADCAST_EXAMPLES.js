/**
 * SOS Broadcasting Integration Examples
 * 
 * This file shows how to integrate SOS broadcasting into your application
 */

// ============================================================================
// 1. BLOOD BANK DASHBOARD: Adding SOS Response Monitor
// ============================================================================

/**
 * Example: app/dashboard/bloodbank/requests/page.js
 * 
 * Add this to your blood bank dashboard to monitor SOS responses
 */

import SOSResponseMonitor from '@/components/SOSResponseMonitor';

export default function BloodBankRequestsPage() {
  const [selectedRequest, setSelectedRequest] = useState(null);

  // When blood bank accepts emergency request, you might want to show monitor
  const handleAcceptEmergency = async (requestId) => {
    try {
      // Call your acceptance API
      const response = await fetch(`/api/hospital-requests/${requestId}/respond`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'accepted',
          action: 'accept'
        })
      });

      if (response.ok) {
        setSelectedRequest(requestId); // Show monitor
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Requests list on left */}
      <div className="lg:col-span-2">
        {/* Your existing requests list */}
      </div>

      {/* SOS Monitor on right (if emergency selected) */}
      {selectedRequest && (
        <div className="lg:col-span-1">
          <SOSResponseMonitor 
            requestId={selectedRequest}
            bloodbankId={userBloodbankId}
            onUpdateResponders={(data) => {
              console.log('New responder:', data.donor_name);
              // You could add audio notification here
              playNotificationSound();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. HOSPITAL DASHBOARD: Trigger SOS Broadcast Helper
// ============================================================================

/**
 * Helper function to trigger SOS broadcast
 * Use this when hospital wants to escalate to SOS immediately
 */

export async function triggerSOSBroadcast(requestId) {
  try {
    console.log(`🚨 Triggering SOS broadcast for request: ${requestId}`);
    
    const response = await fetch(`/api/emergency/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ requestId })
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        message: `✅ SOS broadcasted to ${data.donors_notified || 0} donors`,
        donorsNotified: data.donors_notified,
        requestId
      };
    } else {
      throw new Error(data.error || 'Failed to broadcast SOS');
    }
  } catch (error) {
    console.error('❌ SOS broadcast error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// 3. DONOR DASHBOARD: Show SOS Response Status
// ============================================================================

/**
 * Component to show in donor dashboard after they confirm SOS
 * Shows them the status of their confirmation
 */

import { CheckCircle, AlertCircle, MapPin } from 'lucide-react';

export function SOSResponseStatus({ response }) {
  if (!response) return null;

  return (
    <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-green-800 mb-2">
            ✅ Thank you for confirming!
          </h3>
          
          <div className="space-y-3 mb-4">
            <div>
              <p className="text-sm text-green-700">Hospital:</p>
              <p className="font-semibold text-gray-800">{response.hospital_name}</p>
            </div>

            <div className="flex items-center gap-2">
              <p className="text-sm text-green-700">Number of confirmed donors:</p>
              <span className="inline-block px-3 py-1 bg-green-600 text-white rounded-full font-bold">
                {response.responders_count}
              </span>
            </div>

            {response.all_responders && response.all_responders.length > 0 && (
              <div>
                <p className="text-sm text-green-700 mb-2">You also confirmed:</p>
                <div className="space-y-1">
                  {response.all_responders.slice(0, 3).map((donor, idx) => (
                    <div key={idx} className="text-sm text-gray-700">
                      • {donor.name} ({donor.blood_type})
                    </div>
                  ))}
                  {response.all_responders.length > 3 && (
                    <div className="text-sm text-gray-600">
                      ... and {response.all_responders.length - 3} others
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-green-700 bg-green-100 p-3 rounded">
            💡 The hospital driver will call you for further confirmation. 
            Please be ready!
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. API CALL EXAMPLES
// ============================================================================

/**
 * Example: How donor confirms SOS response
 */
export async function confirmSOSResponse(requestId, donorLocation) {
  try {
    const response = await fetch(`/api/hospital-requests/${requestId}/respond-sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: include auth cookie
      body: JSON.stringify({
        action: 'confirm',
        donor_location: {
          latitude: donorLocation.latitude,
          longitude: donorLocation.longitude
        }
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ SOS response confirmed:', data);
      return {
        success: true,
        ...data
      };
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('❌ Error confirming SOS:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Example: How donor declines SOS response
 */
export async function declineSOSResponse(requestId) {
  try {
    const response = await fetch(`/api/hospital-requests/${requestId}/respond-sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'decline'
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ SOS response declined:', data);
      return {
        success: true,
        ...data
      };
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('❌ Error declining SOS:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// 5. NOTIFICATION SOUND HELPER (Optional)
// ============================================================================

/**
 * Play notification sound when new responder confirms
 * Add audio file to public/sounds/sos-notification.mp3
 */
export function playNotificationSound() {
  try {
    // Option 1: HTML Audio
    const audio = new Audio('/sounds/sos-notification.mp3');
    audio.volume = 0.7;
    audio.play().catch(err => {
      console.warn('Could not play notification sound:', err);
    });
  } catch (error) {
    console.warn('Audio notification failed:', error);
  }
}

/**
 * Alternative: Use Web Audio API for more control
 */
export function playSOSBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    // SOS pattern: 3 short beeps
    const now = audioContext.currentTime;
    oscillator.frequency.value = 800; // 800 Hz

    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(1, now + i * 0.5);
      gain.gain.setValueAtTime(0, now + i * 0.5 + 0.1);
    }

    oscillator.start(now);
    oscillator.stop(now + 1.5);
  } catch (error) {
    console.warn('Web Audio not supported:', error);
  }
}

// ============================================================================
// 6. EMERGENCY REQUEST CREATION EXAMPLE
// ============================================================================

/**
 * Example: Hospital creates emergency request
 */
export async function createEmergencyRequest({
  bloodType,
  unitsNeeded,
  patientName,
  patientAge,
  patientCondition,
  hospitalLocation
}) {
  try {
    const response = await fetch('/api/hospital-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        blood_type: bloodType,
        units_requested: unitsNeeded,
        urgency_level: 'critical',
        is_emergency: true,
        request_type: 'patient',
        patient_details: {
          name: patientName,
          age: patientAge,
          condition: patientCondition
        },
        hospital_location: {
          latitude: hospitalLocation.latitude,
          longitude: hospitalLocation.longitude,
          address: hospitalLocation.address
        },
        search_radius: 10, // 10 km radius
        response_message: 'URGENT - Blood needed immediately!'
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Emergency request created:', data);
      return {
        success: true,
        requestId: data._id,
        ...data
      };
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('❌ Error creating emergency request:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// 7. OPEN GOOGLE MAPS ROUTING
// ============================================================================

/**
 * Open Google Maps with route from donor to hospital
 */
export function openGoogleMapsRoute(donorLocation, hospitalLocation) {
  const origin = `${donorLocation.latitude},${donorLocation.longitude}`;
  const destination = `${hospitalLocation.latitude},${hospitalLocation.longitude}`;
  
  const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}?travelmode=driving`;
  
  // Open in new tab/window
  window.open(googleMapsUrl, '_blank', 'width=800,height=600');
  
  // Or for mobile:
  // window.open(googleMapsUrl, '_self');
}

/**
 * Calculate distance using Haversine formula
 * (This is also done on frontend in emergency-response/page.js)
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
}

// ============================================================================
// 8. TEST/DEBUG HELPERS
// ============================================================================

/**
 * Debug: Log all SOS notification data
 * Add to your app to debug notification issues
 */
export function debugSOSNotification(payload) {
  console.group('🔍 SOS Notification Debug Info');
  console.log('Payload:', payload);
  console.log('Notification:', payload.notification);
  console.log('Data:', payload.data);
  console.log('Type:', payload.data?.type);
  console.log('Request ID:', payload.data?.requestId);
  console.log('URL:', payload.data?.url);
  console.groupEnd();
}

/**
 * Test: Simulate donor confirmation flow
 */
export async function testSOSFlow(requestId, testDonorLocation) {
  console.log('🧪 Starting SOS test flow...');
  
  const result = await confirmSOSResponse(requestId, testDonorLocation);
  
  if (result.success) {
    console.log(`✅ Test flow successful!`);
    console.log(`   Responders: ${result.responders_count}`);
    console.log(`   Hospital: ${result.hospital_name}`);
    return true;
  } else {
    console.error(`❌ Test flow failed:`, result.error);
    return false;
  }
}
