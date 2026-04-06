"use client"
import React from 'react';
import { Clock, CheckCircle, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

/**
 * StatusBadge Component
 * Maps backend BloodRequest statuses to consistent UI styling and icons
 * 
 * Status values from BloodRequest model:
 * - "IN_REVIEW" (default) → Yellow
 * - "APPROVED" → Green
 * - "PARTIAL_APPROVED" → Light Green  
 * - "IN_PROGRESS" → Orange/Red (emergency or geosearch)
 * - "FULFILLED" → Dark Green
 * - "REJECTED" → Red
 * - "CANCELLED" → Gray
 */
export const StatusBadge = ({ status = 'IN_REVIEW', variant = 'default', size = 'md' }) => {
  const normalizeStatus = (s) => {
    if (!s) return 'IN_REVIEW';
    // Handle both old (pending, accepted) and new status formats
    const upperStatus = s.toUpperCase();
    if (upperStatus === 'PENDING') return 'IN_REVIEW';
    if (upperStatus === 'ACCEPTED') return 'APPROVED';
    return upperStatus;
  };

  const normalizedStatus = normalizeStatus(status);

  const statusConfig = {
    'IN_REVIEW': {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      borderColor: 'border-yellow-200 dark:border-yellow-700',
      icon: <Clock className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'In Review',
      dotColor: 'bg-yellow-500',
    },
    'APPROVED': {
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      textColor: 'text-green-800 dark:text-green-300',
      borderColor: 'border-green-200 dark:border-green-700',
      icon: <CheckCircle className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'Approved',
      dotColor: 'bg-green-500',
    },
    'PARTIAL_APPROVED': {
      bgColor: 'bg-lime-100 dark:bg-lime-900/30',
      textColor: 'text-lime-800 dark:text-lime-300',
      borderColor: 'border-lime-200 dark:border-lime-700',
      icon: <CheckCircle2 className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'Partial',
      dotColor: 'bg-lime-500',
    },
    'IN_PROGRESS': {
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      textColor: 'text-orange-800 dark:text-orange-300',
      borderColor: 'border-orange-200 dark:border-orange-700',
      icon: <RefreshCw className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'In Progress',
      dotColor: 'bg-orange-500',
    },
    'FULFILLED': {
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      textColor: 'text-emerald-800 dark:text-emerald-300',
      borderColor: 'border-emerald-200 dark:border-emerald-700',
      icon: <CheckCircle2 className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'Fulfilled',
      dotColor: 'bg-emerald-600',
    },
    'REJECTED': {
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      textColor: 'text-red-800 dark:text-red-300',
      borderColor: 'border-red-200 dark:border-red-700',
      icon: <XCircle className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'Rejected',
      dotColor: 'bg-red-500',
    },
    'CANCELLED': {
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
      textColor: 'text-gray-800 dark:text-gray-300',
      borderColor: 'border-gray-200 dark:border-gray-700',
      icon: <Trash2 className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'Cancelled',
      dotColor: 'bg-gray-500',
    }
  };

  const config = statusConfig[normalizedStatus] || statusConfig['IN_REVIEW'];

  if (variant === 'dot') {
    return (
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${config.dotColor}`} />
        <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }[size];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full font-semibold border ${sizeClasses} ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export default StatusBadge;
