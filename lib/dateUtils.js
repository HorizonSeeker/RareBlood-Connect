/**
 * Date/Time Utility for RareBlood_Connect
 * Handles timezone-safe date operations and consistent time handling
 */

/**
 * Get current UTC timestamp
 * Ensures consistent time handling across different timezones
 * @returns {Date} - Current UTC date
 */
export function getCurrentUTC() {
  return new Date(Date.now());
}

/**
 * Add hours to a date (timezone-aware)
 * @param {Date} date - Base date (defaults to now)
 * @param {number} hours - Number of hours to add
 * @returns {Date} - New date with hours added
 */
export function addHours(date = new Date(), hours = 0) {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + hours);
  return newDate;
}

/**
 * Add days to a date (timezone-aware)
 * @param {Date} date - Base date (defaults to now)
 * @param {number} days - Number of days to add
 * @returns {Date} - New date with days added
 */
export function addDays(date = new Date(), days = 0) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * Add minutes to a date (timezone-aware)
 * @param {Date} date - Base date (defaults to now)
 * @param {number} minutes - Number of minutes to add
 * @returns {Date} - New date with minutes added
 */
export function addMinutes(date = new Date(), minutes = 0) {
  const newDate = new Date(date);
  newDate.setMinutes(newDate.getMinutes() + minutes);
  return newDate;
}

/**
 * Get ISO string (UTC)
 * Safe for database storage
 * @param {Date} date - Date to convert (defaults to now)
 * @returns {string} - ISO 8601 string
 */
export function toISO(date = new Date()) {
  return date.toISOString();
}

/**
 * Get Unix timestamp (milliseconds)
 * Useful for comparisons and expiry checks
 * @param {Date} date - Date to convert (defaults to now)
 * @returns {number} - Timestamp in milliseconds
 */
export function toTimestamp(date = new Date()) {
  return date.getTime();
}

/**
 * Calculate difference between two dates in milliseconds
 * @param {Date} dateA - First date
 * @param {Date} dateB - Second date (defaults to now)
 * @returns {number} - Difference in milliseconds
 */
export function getTimeDifference(dateA, dateB = new Date()) {
  return Math.abs(dateB.getTime() - dateA.getTime());
}

/**
 * Check if date has expired
 * @param {Date} expiryDate - Expiry date
 * @param {Date} checkDate - Date to check against (defaults to now)
 * @returns {boolean} - True if expired
 */
export function isExpired(expiryDate, checkDate = new Date()) {
  return checkDate.getTime() > expiryDate.getTime();
}

/**
 * Get seconds until expiry
 * @param {Date} expiryDate - Expiry date
 * @param {Date} checkDate - Date to check from (defaults to now)
 * @returns {number} - Seconds until expiry (negative if already expired)
 */
export function getSecondsUntilExpiry(expiryDate, checkDate = new Date()) {
  return Math.floor((expiryDate.getTime() - checkDate.getTime()) / 1000);
}

/**
 * Format date for logging
 * @param {Date} date - Date to format
 * @param {boolean} includeTime - Include time in output
 * @returns {string} - Formatted date string
 */
export function formatForLog(date = new Date(), includeTime = true) {
  const isoString = date.toISOString();
  if (includeTime) {
    return isoString;  // Full ISO format: 2026-03-19T14:30:45.123Z
  }
  return isoString.split('T')[0];  // Just date: 2026-03-19
}

/**
 * Create expiry date (safety: always in future)
 * Use this for tokens, contact requests, etc.
 * @param {number} hoursFromNow - Hours until expiry
 * @returns {Date} - Expiry date
 */
export function createExpiryDate(hoursFromNow = 24) {
  const expiryDate = addHours(new Date(), hoursFromNow);
  
  // Safety check: ensure it's in the future
  if (expiryDate.getTime() <= Date.now()) {
    console.warn('[DateUtil] Warning: Expiry date is not in future!', {
      requested: hoursFromNow,
      expiryDate: expiryDate.toISOString()
    });
  }
  
  return expiryDate;
}

/**
 * Safe date JSON serialization (handles timezone bias)
 * @param {Date} date - Date to serialize
 * @returns {string} - ISO string safe for JSON
 */
export function toJSON(date = new Date()) {
  return date.toISOString();
}

export default {
  getCurrentUTC,
  addHours,
  addDays,
  addMinutes,
  toISO,
  toTimestamp,
  getTimeDifference,
  isExpired,
  getSecondsUntilExpiry,
  formatForLog,
  createExpiryDate,
  toJSON
};
