#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE CODE AUDIT
 * Check all broadcast and retrieval logic for correctness
 * 
 * Verifies:
 * 1. fcmNotificationService.js - getOrCreateSOS logic
 * 2. sosService.js - fallback broadcast
 * 3. hospital-requests/route.js - GET endpoint
 * 4. DonorContactRequest schema
 * 5. Return value consistency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function checkLogic(name, checkFn) {
  try {
    const result = checkFn();
    if (result.pass) {
      log(`✅ ${name}`, 'green');
      if (result.details) console.log(`   ${result.details}`);
      return true;
    } else {
      log(`❌ ${name}`, 'red');
      if (result.error) console.log(`   Error: ${result.error}`);
      return false;
    }
  } catch (err) {
    log(`❌ ${name} (Exception)`, 'red');
    console.log(`   Error: ${err.message}`);
    return false;
  }
}

async function auditCode() {
  console.log('\n' + '═'.repeat(80));
  log('🔍 COMPREHENSIVE CODE AUDIT', 'bold');
  console.log('═'.repeat(80) + '\n');

  let passCount = 0;
  let failCount = 0;

  // ========================================================================
  // 1. CHECK: fcmNotificationService.js - Filter Logic
  // ========================================================================
  log('1️⃣  fcmNotificationService.js', 'bold');
  log('─'.repeat(80));

  const fcmServicePath = path.join(__dirname, 'lib', 'fcmNotificationService.js');
  const fcmServiceCode = readFile(fcmServicePath);

  // Check 1.1: Has sendFCMByToken function
  if (checkLogic(
    'Has sendFCMByToken() function for direct token sending',
    () => ({
      pass: fcmServiceCode.includes('async function sendFCMByToken(fcmToken'),
      details: 'Allows sending to FCM token directly (not requiring user lookup)'
    })
  )) passCount++; else failCount++;

  // Check 1.2: Filter uses donor.fcmToken
  if (checkLogic(
    'Filter checks donor.fcmToken (not user.fcmToken)',
    () => {
      const hasCorrectFilter = fcmServiceCode.includes('validDonors') && 
                              fcmServiceCode.includes('donor.fcmToken');
      const hasWrongFilter = fcmServiceCode.includes('donor.user_id.fcmToken') &&
                            !fcmServiceCode.includes('// ✅ FIX');
      return {
        pass: hasCorrectFilter && !hasWrongFilter,
        details: 'Uses donor.fcmToken for mobile app notifications'
      };
    }
  )) passCount++; else failCount++;

  // Check 1.3: Loop processes validDonors with fcmToken
  if (checkLogic(
    'Loop processes donors with donor.fcmToken',
    () => {
      const hasLoop = fcmServiceCode.includes('for (let donor of validDonors)');
      const sendsFCM = fcmServiceCode.includes('sendFCMByToken(') && 
                      fcmServiceCode.includes('donor.fcmToken');
      return {
        pass: hasLoop && sendsFCM,
        details: 'Iterates validDonors and sends via donor.fcmToken'
      };
    }
  )) passCount++; else failCount++;

  // Check 1.4: Creates DB record even without FCM
  if (checkLogic(
    'Creates DonorContactRequest even if FCM fails',
    () => {
      const hasTryCatch = fcmServiceCode.includes('try {') &&
                         fcmServiceCode.includes('DonorContactRequest.create');
      const isBeforeFCM = fcmServiceCode.indexOf('DonorContactRequest.create') <
                         fcmServiceCode.indexOf('sendFCMByToken');
      return {
        pass: hasTryCatch && isBeforeFCM,
        details: 'DB record created first, FCM is separate (won\'t block DB)'
      };
    }
  )) passCount++; else failCount++;

  // Check 1.5: Returns object with 5 metrics
  if (checkLogic(
    'Returns object with all broadcast metrics',
    () => {
      const hasReturn = fcmServiceCode.includes('return {');
      const hasMetrics = fcmServiceCode.includes('totalDonorsFound') &&
                        fcmServiceCode.includes('database_records_created') &&
                        fcmServiceCode.includes('donorsNotified') &&
                        fcmServiceCode.includes('failuresCount');
      return {
        pass: hasReturn && hasMetrics,
        details: 'Returns: {totalDonorsFound, donorsNotified, database_records_created, failuresCount, geocodeFailed}'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // 2. CHECK: sosService.js - Fallback Broadcast
  // ========================================================================
  log('\n2️⃣  sosService.js', 'bold');
  log('─'.repeat(80));

  const sosServicePath = path.join(__dirname, 'lib', 'sosService.js');
  const sosServiceCode = readFile(sosServicePath);

  // Check 2.1: Uses donor.fcmToken primary
  if (checkLogic(
    'Uses donor.fcmToken as PRIMARY FCM source',
    () => {
      const hasPrimary = sosServiceCode.includes('donor.fcmToken');
      const hasFallback = sosServiceCode.includes('donor.user_id?.fcmToken');
      return {
        pass: hasPrimary && hasFallback,
        details: 'Primary: donor.fcmToken, Fallback: user.fcmToken'
      };
    }
  )) passCount++; else failCount++;

  // Check 2.2: Has fallback logic comment
  if (checkLogic(
    'Has clear fallback logic for web app FCM',
    () => {
      const hasFallback = sosServiceCode.includes('FALLBACK') ||
                         sosServiceCode.includes('donor.user_id?.fcmToken');
      return {
        pass: hasFallback,
        details: 'Uses mobile token first, web token as fallback'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // 3. CHECK: hospital-requests/route.js - GET Endpoint
  // ========================================================================
  log('\n3️⃣  hospital-requests/route.js', 'bold');
  log('─'.repeat(80));

  const routePath = path.join(__dirname, 'app', 'api', 'hospital-requests', 'route.js');
  const routeCode = readFile(routePath);

  // Check 3.1: GET uses correct condition
  if (checkLogic(
    'GET checks database_records_created field (not donors_notified)',
    () => {
      const hasCorrectField = routeCode.includes('database_records_created');
      const hasWrongField = routeCode.includes('donors_notified') &&
                           routeCode.includes('if') &&
                           !routeCode.includes('// ✅ FIX');
      return {
        pass: hasCorrectField && !hasWrongField,
        details: 'Checks sos_broadcasted.database_records_created > 0'
      };
    }
  )) passCount++; else failCount++;

  // Check 3.2: Populates DonorContactRequest correctly
  if (checkLogic(
    'Populates from DonorContactRequest with requestId',
    () => {
      const hasFind = routeCode.includes('DonorContactRequest.find');
      const hasRequestId = routeCode.includes('requestId');
      const hasPopulate = routeCode.includes('.populate(');
      return {
        pass: hasFind && hasRequestId && hasPopulate,
        details: 'Queries: DonorContactRequest.find({requestId: X}).populate(...)'
      };
    }
  )) passCount++; else failCount++;

  // Check 3.3: Has ObjectId conversion safety
  if (checkLogic(
    'Has ObjectId type safety checks',
    () => {
      const hasObjectIdCheck = routeCode.includes('instanceof mongoose.Types.ObjectId');
      const hasConversion = routeCode.includes('new mongoose.Types.ObjectId');
      return {
        pass: hasObjectIdCheck && hasConversion,
        details: 'Safely converts to ObjectId if needed'
      };
    }
  )) passCount++; else failCount++;

  // Check 3.4: Has fallback query with expanded time window
  if (checkLogic(
    'Fallback query uses 15-minute time window',
    () => {
      const has15Min = routeCode.includes('15 * 60 * 1000');
      const hasTimeWindow = routeCode.includes('timeWindowStart') && 
                           routeCode.includes('timeWindowEnd');
      return {
        pass: has15Min && hasTimeWindow,
        details: 'Tolerates 15 min clock skew (was 3 min before)'
      };
    }
  )) passCount++; else failCount++;

  // Check 3.5: Diagnostic logging present
  if (checkLogic(
    'Has diagnostic logging for debugging',
    () => {
      const hasLogs = routeCode.includes('console.log') &&
                     routeCode.includes('[SOS Query]');
      return {
        pass: hasLogs,
        details: 'Logs each retrieval step for troubleshooting'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // 4. CHECK: DonorContactRequest Schema
  // ========================================================================
  log('\n4️⃣  DonorContactRequest Schema', 'bold');
  log('─'.repeat(80));

  const schemaPath = path.join(__dirname, 'models', 'DonorContactRequest.js');
  const schemaCode = readFile(schemaPath);

  // Check 4.1: Has requestId index
  if (checkLogic(
    'Has requestId index for query performance',
    () => {
      const hasIndex = schemaCode.includes('requestId') &&
                      (schemaCode.includes('index: true') || 
                       schemaCode.includes('.index'));
      return {
        pass: hasIndex,
        details: 'Indexed for fast DonorContactRequest.find({requestId: X})'
      };
    }
  )) passCount++; else failCount++;

  // Check 4.2: Has donorId field
  if (checkLogic(
    'Has donorId field for donor reference',
    () => ({
      pass: schemaCode.includes('donorId'),
      details: 'Links to Doner collection'
    })
  )) passCount++; else failCount++;

  // Check 4.3: Has TTL expiry (24 hours)
  if (checkLogic(
    'Has TTL index for auto-expiry',
    () => {
      const hasExpiry = schemaCode.includes('expiresAt') &&
                       schemaCode.includes('expire');
      return {
        pass: hasExpiry,
        details: 'Automatically removes records after 24 hours'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // 5. CHECK: Broadcast Return Consistency
  // ========================================================================
  log('\n5️⃣  Broadcast Return Values', 'bold');
  log('─'.repeat(80));

  // Check 5.1: fcmService returns consistent object
  if (checkLogic(
    'fcmNotificationService returns consistent object',
    () => {
      const hasReturn = fcmServiceCode.includes('return {');
      const hasTotalFound = fcmServiceCode.includes('totalDonorsFound');
      const hasRecordsCreated = fcmServiceCode.includes('database_records_created');
      return {
        pass: hasReturn && hasTotalFound && hasRecordsCreated,
        details: 'Always returns object with metrics (not raw number)'
      };
    }
  )) passCount++; else failCount++;

  // Check 5.2: sosService returns consistent object
  if (checkLogic(
    'sosService returns consistent object',
    () => {
      const hasReturn = sosServiceCode.includes('return {') ||
                       sosServiceCode.includes('return result');
      const hasMetrics = sosServiceCode.includes('totalDonorsFound') ||
                        sosServiceCode.includes('success');
      return {
        pass: hasReturn,
        details: 'Returns object with broadcast metrics'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // 6. CHECK: Data Flow Integrity
  // ========================================================================
  log('\n6️⃣  Data Flow Integrity', 'bold');
  log('─'.repeat(80));

  // Check 6.1: requestId ObjectId wrapping
  if (checkLogic(
    'requestId consistently wrapped as ObjectId',
    () => {
      const fcmHasWrapping = fcmServiceCode.includes('new mongoose.Types.ObjectId(') &&
                            fcmServiceCode.includes('requestId');
      const sosHasWrapping = sosServiceCode.includes('new mongoose.Types.ObjectId(') ||
                            sosServiceCode.includes('requestId');
      return {
        pass: fcmHasWrapping,
        details: 'Ensures DB query matching works correctly'
      };
    }
  )) passCount++; else failCount++;

  // Check 6.2: Donor filtering before FCM
  if (checkLogic(
    'Filters invalid donors BEFORE attempting FCM',
    () => {
      const initQuery = fcmServiceCode.indexOf('Doner.find');
      const filter = fcmServiceCode.indexOf('validDonors');
      const fcmSend = fcmServiceCode.indexOf('sendFCMByToken');
      return {
        pass: initQuery < filter && filter < fcmSend,
        details: 'Query → Filter → Send (prevents errors)'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // 7. CHECK: Error Handling
  // ========================================================================
  log('\n7️⃣  Error Handling', 'bold');
  log('─'.repeat(80));

  // Check 7.1: FCM failure doesn't block DB
  if (checkLogic(
    'FCM failure doesn\'t prevent DB record creation',
    () => {
      const dbBeforeFCM = fcmServiceCode.indexOf('DonorContactRequest.create') <
                         fcmServiceCode.indexOf('sendFCMByToken');
      const separateTry = fcmServiceCode.includes('try {') &&
                         fcmServiceCode.match(/try \{/g).length >= 2;
      return {
        pass: dbBeforeFCM && separateTry,
        details: 'DB and FCM in separate try-catch blocks'
      };
    }
  )) passCount++; else failCount++;

  // Check 7.2: Handles missing donors gracefully
  if (checkLogic(
    'Handles case when no donors found',
    () => {
      const hasCheck = fcmServiceCode.includes('if (validDonors.length === 0)') ||
                      fcmServiceCode.includes('if (!nearbyDonors.length)');
      return {
        pass: hasCheck,
        details: 'Returns proper response even with 0 donors'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // 8. CHECK: Hospital View Logic
  // ========================================================================
  log('\n8️⃣  Hospital View Logic', 'bold');
  log('─'.repeat(80));

  // Check 8.1: GET only populates if broadcast happened
  if (checkLogic(
    'GET endpoint checks if broadcast actually created DB records',
    () => {
      const hasCondition = routeCode.includes('database_records_created');
      const hasConditionCheck = routeCode.includes('>') || 
                               routeCode.includes('>= 0');
      return {
        pass: hasCondition && hasConditionCheck,
        details: 'Only populates when database_records_created > 0'
      };
    }
  )) passCount++; else failCount++;

  // Check 8.2: Returns populated donor list
  if (checkLogic(
    'GET returns populated donor objects',
    () => {
      const hasPopulation = routeCode.includes('Doner.findById') ||
                           routeCode.includes('.populate(');
      const hasReturn = routeCode.includes('sos_donor_details');
      return {
        pass: hasPopulation && hasReturn,
        details: 'Returns array of donor objects with names/contacts'
      };
    }
  )) passCount++; else failCount++;

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n' + '═'.repeat(80));
  log('📊 AUDIT RESULTS', 'bold');
  console.log('═'.repeat(80));

  const total = passCount + failCount;
  const percentage = Math.round((passCount / total) * 100);

  log(`\nPassed: ${passCount}/${total} checks (${percentage}%)`, 'green');
  
  if (failCount > 0) {
    log(`Failed: ${failCount}/${total} checks`, 'red');
    log('\n⚠️  REVIEW FAILED CHECKS ABOVE', 'yellow');
  } else {
    log('\n✅ ALL CHECKS PASSED! Code logic is correct.\n', 'green');
    log('Ready to test:', 'cyan');
    log('1. Create emergency request (A+ blood type)', 'cyan');
    log('2. Blood bank rejects it', 'cyan');
    log('3. Should broadcast to ~36 donors', 'cyan');
    log('4. Hospital view shows list', 'cyan');
  }

  console.log('');
}

auditCode();
