'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Phone, MessageCircle, X } from 'lucide-react';

export default function QuickContactDonor({ donor, onClose }) {
  const { data: session } = useSession();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!donor) return null;

  const handleSendContactRequest = async () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/donor-contact-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorId: donor._id,
          bloodType: donor.blood_type,
          urgencyLevel: 'High',
          message: message
        })
      });

      if (response.ok) {
        setSuccess(true);
        setMessage('');
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to send contact request');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 z-[9999]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Contact Donor</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          // Success message
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-green-900 mb-2">Request Sent!</h3>
            <p className="text-sm text-green-700">Contact request has been sent to the donor.</p>
          </div>
        ) : (
          <>
            {/* Donor Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg">
                  {donor.blood_type}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Blood Type</p>
                  <p className="font-semibold text-gray-900">{donor.blood_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Distance</p>
                  <p className="font-semibold text-gray-900">{donor.distance_km} km</p>
                </div>
              </div>
            </div>

            {/* Message Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe your blood request..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows="4"
              />
              <p className="text-sm text-gray-500 mt-1">{message.length}/500 characters</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSendContactRequest}
                disabled={sending || !message.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
