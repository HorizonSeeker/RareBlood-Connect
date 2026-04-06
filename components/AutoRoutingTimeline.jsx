'use client';

import React from 'react';
import { Clock, AlertTriangle, Send, Check, MapPin } from 'lucide-react';

/**
 * AutoRoutingTimeline Component
 * 
 * Displays a visual timeline of auto-routing events:
 * - Request created
 * - Blood bank rejected (triggered auto-routing)
 * - SOS broadcasted
 * - Request forwarded to alternative blood banks
 */
export const AutoRoutingTimeline = ({ hospitalRequest }) => {
  if (!hospitalRequest || hospitalRequest.status !== 'auto_routing') {
    return null;
  }

  // Build timeline events from request data
  const getTimelineEvents = () => {
    const events = [];

    // Event 1: Request created
    if (hospitalRequest.created_at) {
      events.push({
        id: 'created',
        time: hospitalRequest.created_at,
        icon: '📋',
        title: 'Request Created',
        description: `Request for ${hospitalRequest.blood_type} - ${hospitalRequest.units_requested} units`,
        color: 'blue'
      });
    }

    // Event 2: Blood bank rejected and auto-routing triggered
    if (hospitalRequest.updated_at) {
      events.push({
        id: 'rejected',
        time: hospitalRequest.updated_at,
        icon: '❌',
        title: 'Blood Bank Rejected',
        description: 'Emergency auto-routing system activated',
        color: 'red'
      });
    }

    // Event 3: SOS broadcasted
    if (hospitalRequest.sos_broadcasted?.broadcasted_at) {
      const donor_count = hospitalRequest.sos_broadcasted.donors_notified ?? hospitalRequest.sos_broadcasted.donors_fcm_sent ?? 0;
      events.push({
        id: 'sos',
        time: hospitalRequest.sos_broadcasted.broadcasted_at,
        icon: '📢',
        title: `SOS sent to ${donor_count} ${donor_count === 1 ? 'donor' : 'donors'}`,
        description: `Emergency alert to nearby donors (10km radius)`,
        color: 'orange'
      });
    }

    // Event 4: Forwarded to blood banks
    if (hospitalRequest.forwarded_to && hospitalRequest.forwarded_to.length > 0) {
      const latestForward = hospitalRequest.forwarded_to[hospitalRequest.forwarded_to.length - 1];
      if (latestForward.forwarded_at) {
        const bank_count = hospitalRequest.forwarded_to.length;
        events.push({
          id: 'forwarded',
          time: latestForward.forwarded_at,
          icon: '🏥',
          title: `Forwarded to ${bank_count} ${bank_count === 1 ? 'blood bank' : 'blood banks'}`,
          description: `System searching for alternative blood sources`,
          color: 'green'
        });
      }
    }

    return events;
  };

  const events = getTimelineEvents();

  const formatTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'from-blue-100 to-blue-50 border-blue-300 dark:from-blue-900/30 dark:to-blue-900/10 dark:border-blue-700',
      red: 'from-red-100 to-red-50 border-red-300 dark:from-red-900/30 dark:to-red-900/10 dark:border-red-700',
      orange: 'from-orange-100 to-orange-50 border-orange-300 dark:from-orange-900/30 dark:to-orange-900/10 dark:border-orange-700',
      green: 'from-emerald-100 to-emerald-50 border-emerald-300 dark:from-emerald-900/30 dark:to-emerald-900/10 dark:border-emerald-700'
    };
    return colors[color] || colors.blue;
  };

  const getDotColor = (color) => {
    const colors = {
      blue: 'bg-blue-500',
      red: 'bg-red-500',
      orange: 'bg-orange-500',
      green: 'bg-emerald-500'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="mb-6 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-600">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <h3 className="text-lg font-bold text-purple-900 dark:text-purple-200">
          Event Timeline
        </h3>
      </div>

      {/* Timeline */}
      <div className="relative">
        {events.map((event, index) => (
          <div key={event.id} className="mb-6 last:mb-0">
            {/* Timeline line connector */}
            {index < events.length - 1 && (
              <div className="absolute left-6 top-16 w-1 h-12 bg-gradient-to-b from-purple-400 to-purple-200 dark:from-purple-500 dark:to-purple-600" />
            )}

            {/* Event dot */}
            <div className="flex items-start gap-4">
              <div className="relative flex items-center justify-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${getDotColor(event.color)} shadow-md z-10 bg-white dark:bg-gray-800`}>
                  {event.icon}
                </div>
              </div>

              {/* Event details */}
              <div className="flex-1 pt-2">
                <div className={`p-4 rounded-lg border-2 bg-gradient-to-r ${getColorClasses(event.color)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {event.title}
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        {event.description}
                      </p>
                    </div>
                    <div className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap ml-2">
                      {formatTime(event.time)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status indicator */}
      <div className="mt-6 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-300 dark:border-purple-600 text-sm">
        <p className="text-purple-900 dark:text-purple-200">
          <span className="font-bold">Current Status: </span>
          <span className="text-orange-600 dark:text-orange-400 font-semibold">
            🔄 Searching for alternative blood sources
          </span>
        </p>
      </div>
    </div>
  );
};

export default AutoRoutingTimeline;
