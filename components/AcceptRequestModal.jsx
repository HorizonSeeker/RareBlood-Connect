"use client"
import React, { useState } from 'react';
import { X, Truck, Phone, User, Clock } from 'lucide-react';

/**
 * AcceptRequestModal Component
 * Modal for Blood Bank staff to confirm delivery information when accepting a hospital request
 * 
 * Props:
 * - isOpen: Boolean to control modal visibility
 * - onClose: Callback function to close modal
 * - onConfirm: Callback function to handle form submission with delivery info
 * - request: The hospital request object
 * - isLoading: Boolean to show loading state
 */
export const AcceptRequestModal = ({ isOpen, onClose, onConfirm, request, isLoading = false }) => {
  const [formData, setFormData] = useState({
    estimated_minutes: '',
    driver_name: '',
    driver_phone: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  if (!isOpen || !request) return null;

  // Validate form data
  const validateForm = () => {
    const newErrors = {};

    if (!formData.estimated_minutes || formData.estimated_minutes < 1 || formData.estimated_minutes > 1440) {
      newErrors.estimated_minutes = 'Please enter time between 1 and 1440 minutes (24 hours)';
    }

    if (!formData.driver_name.trim()) {
      newErrors.driver_name = 'Driver name is required';
    }

    if (!formData.driver_phone.trim()) {
      newErrors.driver_phone = 'Driver phone is required';
    }

    // Basic phone validation (at least 10 characters)
    if (formData.driver_phone.trim() && formData.driver_phone.trim().length < 10) {
      newErrors.driver_phone = 'Please enter a valid phone number';
    }

    return newErrors;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  };

  const handleConfirm = async () => {
    const newErrors = validateForm();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Call the confirm callback with delivery info
    await onConfirm({
      estimated_minutes: parseInt(formData.estimated_minutes),
      driver_name: formData.driver_name.trim(),
      driver_phone: formData.driver_phone.trim()
    });

    // Reset form
    setFormData({
      estimated_minutes: '',
      driver_name: '',
      driver_phone: ''
    });
    setErrors({});
    setTouched({});
  };

  const handleClose = () => {
    setFormData({
      estimated_minutes: '',
      driver_name: '',
      driver_phone: ''
    });
    setErrors({});
    setTouched({});
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
          
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-white" />
              <h2 className="text-xl font-bold text-white">Confirm Delivery Info</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-white hover:bg-blue-700 dark:hover:bg-blue-800 p-1 rounded transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            
            {/* Request Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
                  <span className="text-2xl font-bold text-red-600">
                    {request.blood_type}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {request.units_requested} Units Requested
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {request.request_type === 'patient' ? 'Patient Request' : 'Inventory Request'}
                  </p>
                </div>
              </div>
              {request.patient_details?.name && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Patient: {request.patient_details.name}
                </p>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              
              {/* Estimated Time */}
              <div>
                <label htmlFor="estimated_minutes" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Estimated Arrival Time
                  </div>
                </label>
                <input
                  type="number"
                  id="estimated_minutes"
                  name="estimated_minutes"
                  value={formData.estimated_minutes}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g., 30 minutes"
                  min="1"
                  max="1440"
                  disabled={isLoading}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.estimated_minutes && touched.estimated_minutes
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white'
                  }`}
                />
                {errors.estimated_minutes && touched.estimated_minutes && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.estimated_minutes}</p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter minutes (1-1440)</p>
              </div>

              {/* Driver Name */}
              <div>
                <label htmlFor="driver_name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Driver Name
                  </div>
                </label>
                <input
                  type="text"
                  id="driver_name"
                  name="driver_name"
                  value={formData.driver_name}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g., Nguyễn Văn An"
                  disabled={isLoading}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.driver_name && touched.driver_name
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white'
                  }`}
                />
                {errors.driver_name && touched.driver_name && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.driver_name}</p>
                )}
              </div>

              {/* Driver Phone */}
              <div>
                <label htmlFor="driver_phone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Driver Phone Number
                  </div>
                </label>
                <input
                  type="tel"
                  id="driver_phone"
                  name="driver_phone"
                  value={formData.driver_phone}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g., +84901234567"
                  disabled={isLoading}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.driver_phone && touched.driver_phone
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white'
                  }`}
                />
                {errors.driver_phone && touched.driver_phone && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.driver_phone}</p>
                )}
              </div>
            </div>

            {/* Info Message */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-700 dark:text-green-400">
                ✅ This information will be sent to the hospital so they can track the ambulance arrival.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-3 justify-end">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 text-white hover:from-green-700 hover:to-green-800 dark:hover:from-green-800 dark:hover:to-green-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Confirming...
                </>
              ) : (
                <>
                  ✓ Confirm & Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AcceptRequestModal;
