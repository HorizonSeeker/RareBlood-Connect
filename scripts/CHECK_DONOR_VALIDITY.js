#!/usr/bin/env node

/**
 * 🔍 DIAGNOSTIC SCRIPT: Check Why No Donors Found
 * 
 * This script verifies:
 * 1. Total donors in system
 * 2. Active donors (is_active = true)
 * 3. Donors with valid status
 * 4. Donors with blood type data
 * 5. Donors with geolocation data
 * 6. Donors with FCM tokens
 * 7. Breakdown by blood type
 * 
 * Run with: node CHECK_DONOR_VALIDITY.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

import Doner from './models/Doner.js';
import User from './models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rareblood';

// Color codes for terminal
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

async function checkDonors() {
  try {
    console.log('\n' + '═'.repeat(80));
    log('🔍 DONOR VALIDATION DIAGNOSTIC', 'bold');
    console.log('═'.repeat(80) + '\n');

    log(`Connecting to: ${MONGODB_URI.substring(0, 50)}...`, 'cyan');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log('✅ Connected to MongoDB\n', 'green');

    // ========================================================================
    // 1. TOTAL DONORS
    // ========================================================================
    log('1️⃣  TOTAL DONORS IN SYSTEM', 'bold');
    log('─'.repeat(80));

    const totalDonors = await Doner.countDocuments({});
    log(`Total donors: ${totalDonors}`);

    if (totalDonors === 0) {
      log('❌ NO DONORS IN DATABASE! Create test donors first.', 'red');
      await mongoose.connection.close();
      return;
    }

    // ========================================================================
    // 2. ACTIVE STATUS CHECK
    // ========================================================================
    log('\n2️⃣  ACTIVE STATUS BREAKDOWN', 'bold');
    log('─'.repeat(80));

    const activeDonors = await Doner.countDocuments({ is_active: true });
    const inactiveDonors = await Doner.countDocuments({ is_active: false });

    log(`Active (is_active=true):   ${activeDonors} ${activeDonors > 0 ? '✅' : '❌'}`);
    log(`Inactive (is_active=false): ${inactiveDonors}`);

    if (activeDonors === 0) {
      log('❌ NO ACTIVE DONORS! All donors are marked inactive.', 'red');
      log('   Solution: Update donors with is_active=true\n', 'yellow');
    }

    // ========================================================================
    // 3. DONOR STATUS ENUM
    // ========================================================================
    log('\n3️⃣  DONOR STATUS BREAKDOWN', 'bold');
    log('─'.repeat(80));

    const statuses = ['active', 'inactive', 'banned', 'on_cooldown'];
    for (const status of statuses) {
      const count = await Doner.countDocuments({ status });
      const icon = count > 0 ? '✅' : '⭕';
      log(`Status='${status}': ${count} donors ${icon}`);
    }

    // ========================================================================
    // 4. BLOOD TYPE DISTRIBUTION
    // ========================================================================
    log('\n4️⃣  BLOOD TYPE DISTRIBUTION', 'bold');
    log('─'.repeat(80));

    const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    let totalWithBloodType = 0;

    for (const bloodType of bloodTypes) {
      const count = await Doner.countDocuments({ blood_type: bloodType });
      if (count > 0) {
        log(`${bloodType}: ${count} donors ✅`);
        totalWithBloodType += count;
      }
    }

    const nullBloodType = await Doner.countDocuments({ blood_type: { $in: [null, ''] } });
    if (nullBloodType > 0) {
      log(`(no blood type): ${nullBloodType} donors ❌`, 'red');
    }

    log(`Total with blood_type: ${totalWithBloodType}/${totalDonors}`);

    // ========================================================================
    // 5. GEOLOCATION CHECK
    // ========================================================================
    log('\n5️⃣  GEOLOCATION DATA', 'bold');
    log('─'.repeat(80));

    const withLocation = await Doner.countDocuments({
      'current_location.coordinates': { $exists: true, $ne: null }
    });

    const withValidCoordinates = await Doner.countDocuments({
      'current_location.type': 'Point',
      'current_location.coordinates': { $type: 'array', $size: 2 }
    });

    const withoutLocation = totalDonors - withLocation;

    log(`Donors with location data: ${withLocation}/${totalDonors}`);
    log(`Donors with valid [lon, lat]: ${withValidCoordinates}/${totalDonors}`);
    log(`Donors WITHOUT location: ${withoutLocation}/${totalDonors} ${withoutLocation > 0 ? '❌' : '✅'}`);

    if (withoutLocation > 0) {
      log(`\n⚠️  ${withoutLocation} donors lack location data!`, 'yellow');
      log('   These donors cannot be found by geospatial query.\n', 'yellow');
    }

    // ========================================================================
    // 6. FCM TOKEN CHECK
    // ========================================================================
    log('\n6️⃣  FCM TOKEN FOR NOTIFICATIONS', 'bold');
    log('─'.repeat(80));

    const withFCM = await Doner.countDocuments({ fcmToken: { $exists: true, $ne: null } });
    const withoutFCM = totalDonors - withFCM;

    log(`Donors with FCM token: ${withFCM}/${totalDonors}`);
    log(`Donors WITHOUT FCM: ${withoutFCM}/${totalDonors} ${withoutFCM > 0 ? '⚠️' : '✅'}`);

    if (withoutFCM > 0) {
      log(`\n⚠️  ${withoutFCM} donors lack FCM tokens!`, 'yellow');
      log('   They won\'t receive push notifications.\n', 'yellow');
    }

    // ========================================================================
    // 7. USER PROFILE LINK CHECK
    // ========================================================================
    log('\n7️⃣  USER PROFILE VALIDATION', 'bold');
    log('─'.repeat(80));

    const donors = await Doner.find({}).populate('user_id', 'name email role');
    let validUsers = 0;
    let missingUsers = 0;
    let invalidRoles = 0;

    for (const donor of donors) {
      if (!donor.user_id) {
        missingUsers++;
      } else if (donor.user_id.role !== 'user') {
        invalidRoles++;
      } else {
        validUsers++;
      }
    }

    log(`Donors with valid user: ${validUsers}/${totalDonors} ✅`);
    log(`Donors with missing user: ${missingUsers}/${totalDonors} ${missingUsers > 0 ? '❌' : ''}`);
    log(`Donors with wrong role: ${invalidRoles}/${totalDonors} ${invalidRoles > 0 ? '❌' : ''}`);

    // ========================================================================
    // 8. VERIFICATION STATUS
    // ========================================================================
    log('\n8️⃣  VERIFICATION STATUS', 'bold');
    log('─'.repeat(80));

    const verified = await Doner.countDocuments({ verification_status: 'VERIFIED' });
    const pending = await Doner.countDocuments({ verification_status: 'PENDING' });
    const rejected = await Doner.countDocuments({ verification_status: 'REJECTED' });

    log(`Verified: ${verified}/${totalDonors} ✅`);
    log(`Pending: ${pending}/${totalDonors}`);
    log(`Rejected: ${rejected}/${totalDonors} ${rejected > 0 ? '❌' : ''}`);

    if (verified === 0) {
      log('\n⚠️  NO VERIFIED DONORS! Medical proof not approved yet.', 'yellow');
    }

    // ========================================================================
    // 9. COMBINED CRITERIA (For geospatial search)
    // ========================================================================
    log('\n9️⃣  COMBINED CRITERIA CHECK (Query-Ready Donors)', 'bold');
    log('─'.repeat(80));
    log('Donors that WILL be found by geospatial query:\n', 'cyan');

    const bloodType = 'O+'; // Example

    const queryReadyDonors = await Doner.countDocuments({
      is_active: true,
      blood_type: bloodType,
      'current_location.type': 'Point',
      'current_location.coordinates': { $exists: true }
    });

    log(`Blood Type=${bloodType} + is_active=true + has location:`);
    log(`Result: ${queryReadyDonors} donors\n`);

    if (queryReadyDonors === 0) {
      log('❌ NO DONORS MATCH QUERY CRITERIA!', 'red');
      log('   This is why broadcast finds 0 donors!\n', 'red');
    } else {
      log(`✅ ${queryReadyDonors} donors can be found by query\n`, 'green');
    }

    // Show breakdown for all blood types
    log('Breakdown by blood type (is_active + has location):\n', 'cyan');
    for (const bt of bloodTypes) {
      const count = await Doner.countDocuments({
        is_active: true,
        blood_type: bt,
        'current_location.type': 'Point',
        'current_location.coordinates': { $exists: true }
      });
      if (count > 0) {
        log(`  ${bt}: ${count} donors ✅`);
      }
    }

    // ========================================================================
    // 10. SUMMARY & RECOMMENDATIONS
    // ========================================================================
    log('\n🎯 SUMMARY & RECOMMENDATIONS', 'bold');
    log('═'.repeat(80));

    const issues = [];

    if (totalDonors === 0) {
      issues.push('❌ No donors exist in database');
    }

    if (activeDonors === 0) {
      issues.push('❌ No active donors (is_active=false for all)');
    }

    if (withoutLocation > 0) {
      issues.push(`⚠️  ${withoutLocation} donors missing location data`);
    }

    if (withoutFCM > 0) {
      issues.push(`⚠️  ${withoutFCM} donors missing FCM tokens`);
    }

    if (queryReadyDonors === 0) {
      issues.push('❌ Zero donors match query criteria (CRITICAL!)');
    }

    if (issues.length === 0) {
      log('\n✅ ALL CHECKS PASSED! System is ready.', 'green');
      log(`   - ${totalDonors} total donors`);
      log(`   - ${activeDonors} active donors`);
      log(`   - ${queryReadyDonors} query-ready donors (can be found)\n`, 'green');
    } else {
      log('\n📋 Issues Found:\n', 'red');
      issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });

      log('\n💡 Solutions:\n', 'yellow');

      if (totalDonors === 0) {
        log('  • Create test donors with valid data', 'yellow');
      }

      if (activeDonors === 0) {
        log('  • Run: db.doners.updateMany({}, {$set: {is_active: true}})', 'yellow');
      }

      if (withoutLocation > 0) {
        log(`  • Add location to ${withoutLocation} donors`, 'yellow');
        log(`    Run: node UPDATE_DONOR_LOCATIONS.js`, 'yellow');
      }

      if (withoutFCM > 0) {
        log(`  • ${withoutFCM} donors missing FCM (they can\'t get notifications)`, 'yellow');
      }

      if (verified === 0) {
        log('  • Verify donor medical documents first', 'yellow');
      }
    }

    // ========================================================================
    // 11. DETAILED DONOR SAMPLE
    // ========================================================================
    log('\n📊 SAMPLE DONOR DETAILS (First Active Donor):', 'bold');
    log('─'.repeat(80));

    const sample = await Doner.findOne({ is_active: true })
      .populate('user_id', 'name email phone role');

    if (sample) {
      log(`ID: ${sample._id}`);
      log(`Name: ${sample.user_id?.name || 'N/A'}`);
      log(`Email: ${sample.user_id?.email || 'N/A'}`);
      log(`Blood Type: ${sample.blood_type}`);
      log(`Active: ${sample.is_active}`);
      log(`Status: ${sample.status}`);
      log(`Has Location: ${sample.current_location?.coordinates ? 'Yes' : 'No'}`);
      if (sample.current_location?.coordinates) {
        log(`  Coordinates: [${sample.current_location.coordinates[0]}, ${sample.current_location.coordinates[1]}]`);
      }
      log(`Has FCM: ${sample.fcmToken ? 'Yes' : 'No'}`);
      log(`Verified: ${sample.verification_status}`);
    }

    console.log('');
    await mongoose.connection.close();
    log('✅ Diagnostic complete!\n', 'green');

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run
checkDonors();
