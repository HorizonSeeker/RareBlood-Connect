"use client"
import React from 'react';
import { AlertTriangle, AlertCircle, Clock, Check } from 'lucide-react';

/**
 * PriorityBadge Component
 * Maps urgency levels to consistent UI styling
 * 
 * Urgency levels from BloodRequest model:
 * - "CRITICAL" → Red, AlertTriangle icon, bold
 * - "HIGH" → Orange, AlertTriangle icon
 * - "MEDIUM" → Yellow, Clock icon
 * - "LOW" → Green, Check icon
 */
export const PriorityBadge = ({ urgency = 'MEDIUM', variant = 'default', size = 'md' }) => {
  const normalizeUrgency = (u) => {
    if (!u) return 'MEDIUM';
    const upperUrgency = u.toUpperCase();
    // Handle variations
    if (upperUrgency === 'CRITICAL' || upperUrgency === 'EMERGENCY') return 'CRITICAL';
    if (upperUrgency === 'HIGH') return 'HIGH';
    if (upperUrgency === 'MEDIUM') return 'MEDIUM';
    if (upperUrgency === 'LOW') return 'LOW';
    return 'MEDIUM';
  };

  const normalizedUrgency = normalizeUrgency(urgency);

  const urgencyConfig = {
    'CRITICAL': {
      bgColor: 'bg-red-100 dark:bg-red-900/40',
      textColor: 'text-red-700 dark:text-red-300',
      borderColor: 'border-red-300 dark:border-red-700',
      icon: <AlertTriangle className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'CRITICAL',
      dotColor: 'bg-red-600',
      highlightClass: 'shadow-lg shadow-red-500/20',
    },
    'HIGH': {
      bgColor: 'bg-orange-100 dark:bg-orange-900/40',
      textColor: 'text-orange-700 dark:text-orange-300',
      borderColor: 'border-orange-300 dark:border-orange-700',
      icon: <AlertTriangle className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'HIGH',
      dotColor: 'bg-orange-600',
      highlightClass: 'shadow-md shadow-orange-500/10',
    },
    'MEDIUM': {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/40',
      textColor: 'text-yellow-700 dark:text-yellow-300',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
      icon: <Clock className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'MEDIUM',
      dotColor: 'bg-yellow-500',
      highlightClass: '',
    },
    'LOW': {
      bgColor: 'bg-green-100 dark:bg-green-900/40',
      textColor: 'text-green-700 dark:text-green-300',
      borderColor: 'border-green-300 dark:border-green-700',
      icon: <Check className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />,
      label: 'LOW',
      dotColor: 'bg-green-600',
      highlightClass: '',
    }
  };

  const config = urgencyConfig[normalizedUrgency] || urgencyConfig['MEDIUM'];

  if (variant === 'dot') {
    return (
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${config.dotColor}`} />
        <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }[size];

  return (
    <span className={`inline-flex items-center gap-2 rounded-lg font-bold border-2 ${sizeClasses} ${config.bgColor} ${config.textColor} ${config.borderColor} ${config.highlightClass}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export default PriorityBadge;
