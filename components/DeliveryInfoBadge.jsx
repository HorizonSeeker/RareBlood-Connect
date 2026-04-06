"use client"
import React from 'react';
import { Truck, Phone, User, Clock } from 'lucide-react';

/**
 * DeliveryInfoBadge Component
 * Displays delivery information for accepted/fulfilled hospital requests
 * Shows driver name, phone, and ETA
 * 
 * Props:
 * - deliveryInfo: Object containing estimated_minutes, driver_name, driver_phone
 */
export const DeliveryInfoBadge = ({ deliveryInfo }) => {
  if (!deliveryInfo) return null;

  const { estimated_minutes, driver_name, driver_phone } = deliveryInfo;

  if (!estimated_minutes || !driver_name || !driver_phone) return null;

  return (
    <div className="w-full bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex-shrink-0">
          <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="currentColor" />
        </div>
        <span className="font-bold text-emerald-700 dark:text-emerald-300 text-base">
          🚑 Ambulance On The Way!
        </span>
      </div>

      {/* Delivery Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Driver Name */}
        <div className="flex items-start gap-2 bg-white dark:bg-slate-800 rounded-lg p-3">
          <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Driver</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {driver_name}
            </p>
          </div>
        </div>

        {/* Driver Phone */}
        <div className="flex items-start gap-2 bg-white dark:bg-slate-800 rounded-lg p-3">
          <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Contact</p>
            <a href={`tel:${driver_phone}`} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline truncate">
              {driver_phone}
            </a>
          </div>
        </div>

        {/* Estimated Time */}
        <div className="flex items-start gap-2 bg-white dark:bg-slate-800 rounded-lg p-3">
          <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">ETA</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {estimated_minutes} <span className="text-xs font-normal">min</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700">
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          💚 Blood bank has confirmed delivery. Please have the necessary medical staff ready.
        </p>
      </div>
    </div>
  );
};

export default DeliveryInfoBadge;
