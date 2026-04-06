/**
 * Blood Request Utility Functions
 * Helper functions for sorting, filtering, and formatting blood requests
 */

/**
 * Priority levels in descending order
 */
export const PRIORITY_ORDER = {
  'CRITICAL': 1,
  'HIGH': 2,
  'MEDIUM': 3,
  'LOW': 4
};

/**
 * Sort requests by priority (CRITICAL > HIGH > MEDIUM > LOW)
 * Then by creation date (newest first)
 */
export const sortByPriority = (requests) => {
  if (!Array.isArray(requests)) return [];
  
  return [...requests].sort((a, b) => {
    // First, sort by priority
    const priorityA = PRIORITY_ORDER[a.urgency_level?.toUpperCase()] ?? 999;
    const priorityB = PRIORITY_ORDER[b.urgency_level?.toUpperCase()] ?? 999;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // If same priority, sort by date (newer first)
    const dateA = new Date(a.requested_date || a.created_at).getTime();
    const dateB = new Date(b.requested_date || b.created_at).getTime();
    return dateB - dateA;
  });
};

/**
 * Filter requests by status
 */
export const filterByStatus = (requests, status) => {
  if (!Array.isArray(requests)) return [];
  if (!status) return requests;
  
  const normalizeStatus = (s) => {
    const upper = s?.toUpperCase();
    if (upper === 'PENDING') return 'IN_REVIEW';
    if (upper === 'ACCEPTED') return 'APPROVED';
    return upper;
  };
  
  const normalizedStatus = normalizeStatus(status);
  return requests.filter(req => normalizeStatus(req.status) === normalizedStatus);
};

/**
 * Determine if a request is emergency
 */
export const isEmergencyRequest = (request) => {
  return request?.request_type === 'emergency' || !request?.bloodbank_id || request?.status === 'IN_PROGRESS';
};

/**
 * Group requests by status
 */
export const groupByStatus = (requests) => {
  if (!Array.isArray(requests)) return {};
  
  return requests.reduce((groups, request) => {
    const status = request.status || 'IN_REVIEW';
    if (!groups[status]) {
      groups[status] = [];
    }
    groups[status].push(request);
    return groups;
  }, {});
};

/**
 * Get requests that are active (not completed or rejected)
 */
export const getActiveRequests = (requests) => {
  const activeStatuses = ['IN_REVIEW', 'IN_PROGRESS', 'APPROVED', 'PARTIAL_APPROVED'];
  return filterByStatus(requests, activeStatuses);
};

/**
 * Format date in a human-readable way
 */
export const formatRequestDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if date is today
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  
  // Check if date is yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Otherwise show full date
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Check if request is recent (within last hour)
 */
export const isRecentRequest = (request, minutes = 60) => {
  const requestTime = new Date(request.requested_date || request.created_at).getTime();
  const now = Date.now();
  return (now - requestTime) < (minutes * 60 * 1000);
};

/**
 * Get compatible blood types for a given blood type
 */
export const getBloodTypeInfo = (bloodType) => {
  const compatibilityMap = {
    'O+': {
      canDonate: ['O+', 'A+', 'B+', 'AB+'],
      canReceive: ['O+'],
      label: 'Universal Donor',
    },
    'O-': {
      canDonate: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
      canReceive: ['O-'],
      label: 'Universal Donor (RH-)',
    },
    'A+': {
      canDonate: ['A+', 'AB+'],
      canReceive: ['O+', 'A+'],
      label: 'Common',
    },
    'A-': {
      canDonate: ['A+', 'A-', 'AB+', 'AB-'],
      canReceive: ['O-', 'A-'],
      label: 'RH-',
    },
    'B+': {
      canDonate: ['B+', 'AB+'],
      canReceive: ['O+', 'B+'],
      label: 'Common',
    },
    'B-': {
      canDonate: ['B+', 'B-', 'AB+', 'AB-'],
      canReceive: ['O-', 'B-'],
      label: 'RH-',
    },
    'AB+': {
      canDonate: ['AB+'],
      canReceive: ['O+', 'A+', 'B+', 'AB+'],
      label: 'Universal Recipient',
    },
    'AB-': {
      canDonate: ['AB+', 'AB-'],
      canReceive: ['O-', 'A-', 'B-', 'AB-'],
      label: 'Universal Recipient (RH-)',
    }
  };

  return compatibilityMap[bloodType] || null;
};
