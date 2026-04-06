'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Custom Time Select Component
 * Displays time in 24-hour format (HH:mm) with 30-minute intervals
 * Avoids browser locale issues with input type="time"
 */
export default function TimeSelect({ 
  value, 
  onChange, 
  label, 
  placeholder = "Select time",
  required = false,
  error = false,
  disabled = false,
  className = "" 
}) {
  // Generate time options from 00:00 to 23:30 in 30-minute intervals
  const generateTimeOptions = () => {
    const options = [];
    for (let hours = 0; hours < 24; hours++) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        options.push({
          value: timeString,
          label: timeString
        });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent 
            bg-[var(--background)] text-[var(--text-primary)] appearance-none cursor-pointer
            placeholder-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${error 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-[var(--border)] focus:ring-[#ef4444]'
            }
            ${className}`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {timeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
      </div>
    </div>
  );
}
