/**
 * 🔍 VERIFICATION SCRIPT: Donor Count Consistency Check
 * 
 * This script verifies that the number of donors shown when a request is rejected
 * matches exactly with the number of donors in the database.
 * 
 * Run with: node VERIFY_DONOR_COUNT_CONSISTENCY.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Models
import HospitalRequest from './models/HospitalRequest.js';
import DonorContactRequest from './models/DonorContactRequest.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rareblood';

// ============================================================================
// MAIN VERIFICATION LOGIC
// ============================================================================

async function verifyDonorCounts() {
  try {
    console.log('\n📊 DONOR COUNT CONSISTENCY VERIFICATION');
    console.log('='.repeat(80));
    console.log(`Connecting to MongoDB: ${MONGODB_URI.substring(0, 50)}...`);

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB\n');

    // Find all emergency requests with SOS broadcasted
    const emergencyRequests = await HospitalRequest.find({
      is_emergency: true,
      'sos_broadcasted.triggered': true,
    }).lean();

    console.log(`📋 Found ${emergencyRequests.length} emergency requests with SOS broadcasts\n`);

    if (emergencyRequests.length === 0) {
      console.log('ℹ️  No emergency broadcasts found. Test scenario:');
      console.log('  1. Create an emergency request');
      console.log('  2. Have a blood bank reject it');
      console.log('  3. Auto-routing will trigger and broadcast to donors');
      console.log('  4. Then run this verification script again\n');
      await mongoose.connection.close();
      return;
    }

    // Check each request
    let issuesFound = 0;
    const results = [];

    for (const request of emergencyRequests) {
      console.log(`\n🔍 Checking Request ${request._id.toString().substring(0, 12)}...`);
      console.log('─'.repeat(80));

      // Get stored metrics
      const storedTotalFound = request.sos_broadcasted?.total_donors_found || 0;
      const storedFcmSent = request.sos_broadcasted?.donors_fcm_sent || 0;
      const storedDbCreated = request.sos_broadcasted?.database_records_created || 0;
      const storedFailures = request.sos_broadcasted?.failures_count || 0;

      console.log('📊 STORED METRICS:');
      console.log(`   Total Donors Found:    ${storedTotalFound}`);
      console.log(`   FCM Notifications:     ${storedFcmSent}`);
      console.log(`   DB Records Created:    ${storedDbCreated}`);
      console.log(`   Failures:              ${storedFailures}`);

      // Query actual DonorContactRequest records
      const actualRecords = await DonorContactRequest.find({
        requestId: request._id,
      }).countDocuments();

      console.log(`\n💾 ACTUAL DATABASE COUNT:`);
      console.log(`   DonorContactRequest:   ${actualRecords}`);

      // Detailed breakdown
      const recordsWithFcmSent = await DonorContactRequest.find({
        requestId: request._id,
        broadcast_notification_sent: true,
      }).countDocuments();

      const recordsWithoutFcm = await DonorContactRequest.find({
        requestId: request._id,
        broadcast_notification_sent: false,
      }).countDocuments();

      console.log(`   - With FCM sent:       ${recordsWithFcmSent}`);
      console.log(`   - Without FCM:         ${recordsWithoutFcm}`);

      // Verify consistency
      console.log(`\n✓ VERIFICATION RESULTS:`);

      const checks = [
        {
          name: 'DB Records = Stored Records',
          actual: actualRecords,
          expected: storedDbCreated,
          critical: true,
        },
        {
          name: 'FCM Sent = Records with broadcast_notification_sent',
          actual: recordsWithFcmSent,
          expected: storedFcmSent,
          critical: true,
        },
        {
          name: 'FCM Sent <= Total Records',
          actual: storedFcmSent,
          expected: storedDbCreated,
          checkType: 'lte',
          critical: false,
        },
      ];

      for (const check of checks) {
        let passed = false;
        if (check.checkType === 'lte') {
          passed = check.actual <= check.expected;
        } else {
          passed = check.actual === check.expected;
        }

        const icon = passed ? '✅' : '❌';
        console.log(`  ${icon} ${check.name}`);

        if (!passed) {
          console.log(`     Expected: ${check.expected}, Actual: ${check.actual}`);
          if (check.critical) {
            issuesFound++;
            results.push({
              requestId: request._id.toString(),
              issue: check.name,
              expected: check.expected,
              actual: check.actual,
              critical: true,
            });
          }
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📈 VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Requests Checked:      ${emergencyRequests.length}`);
    console.log(`Issues Found:          ${issuesFound}`);

    if (issuesFound === 0) {
      console.log('\n✅ ALL CHECKS PASSED! Donor counts are consistent.\n');
    } else {
      console.log(`\n⚠️  ${issuesFound} critical issue(s) detected!\n`);
      console.log('DETAILED ISSUES:');
      for (const result of results) {
        console.log(
          `  • Request ${result.requestId.substring(0, 12)}:`
        );
        console.log(`    ${result.issue}`);
        console.log(`    Expected: ${result.expected}, Actual: ${result.actual}`);
      }
    }

    console.log('\n💡 INTERPRETATION GUIDE:');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('• DB Records < Stored Records: Some DonorContactRequest not created (DB failure)');
    console.log('• FCM Sent < DB Records: Some donors lack FCM token or notification failed');
    console.log('• FCM Sent > DB Records: Critical logic error - should not happen');
    console.log('────────────────────────────────────────────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed.\n');
  }
}

// ============================================================================
// ADVANCED: Check specific request by ID
// ============================================================================

async function verifySpecificRequest(requestId) {
  try {
    console.log(`\n🔍 DETAILED ANALYSIS FOR REQUEST: ${requestId}\n`);
    console.log('='.repeat(80));

    await mongoose.connect(MONGODB_URI);

    const request = await HospitalRequest.findById(requestId).lean();

    if (!request) {
      console.error(`❌ Request not found: ${requestId}`);
      await mongoose.connection.close();
      return;
    }

    console.log('📋 Request Details:');
    console.log(`  Blood Type:      ${request.blood_type}`);
    console.log(`  Units Requested: ${request.units_requested}`);
    console.log(`  Status:          ${request.status}`);
    console.log(`  Is Emergency:    ${request.is_emergency}`);
    console.log(`  Created At:      ${request.created_at || 'N/A'}`);

    if (request.sos_broadcasted?.triggered) {
      console.log('\n📊 SOS Broadcast Metrics:');
      console.log(`  Total Donors Found:     ${request.sos_broadcasted.total_donors_found}`);
      console.log(`  FCM Notifications Sent: ${request.sos_broadcasted.donors_fcm_sent}`);
      console.log(`  DB Records Created:     ${request.sos_broadcasted.database_records_created}`);
      console.log(`  Failures Count:         ${request.sos_broadcasted.failures_count}`);
      console.log(`  Broadcasted At:         ${request.sos_broadcasted.broadcasted_at}`);

      // Query all donor contact requests
      const allRecords = await DonorContactRequest.find({
        requestId: mongoose.Types.ObjectId(requestId),
      })
        .populate('donorId', 'blood_type is_active')
        .lean();

      console.log(`\n💾 Database Records Found: ${allRecords.length}`);

      if (allRecords.length > 0) {
        console.log('\nDetailed Record List:');
        for (let i = 0; i < allRecords.length && i < 10; i++) {
          const record = allRecords[i];
          console.log(`  ${i + 1}. Donor ${record.donorId._id.toString().substring(0, 12)}`);
          console.log(`     Status: ${record.status}`);
          console.log(`     FCM Sent: ${record.broadcast_notification_sent ? '✅' : '❌'}`);
          console.log(`     Created: ${record.createdAt}`);
        }

        if (allRecords.length > 10) {
          console.log(`  ... and ${allRecords.length - 10} more`);
        }
      }

      // Check for discrepancies
      console.log(`\n🔎 DISCREPANCY ANALYSIS:`);
      const fcmSentRecords = allRecords.filter((r) => r.broadcast_notification_sent).length;
      const storedFcm = request.sos_broadcasted.donors_fcm_sent;
      const storedDb = request.sos_broadcasted.database_records_created;

      if (allRecords.length !== storedDb) {
        console.log(`  ⚠️  DB Count Mismatch:`);
        console.log(`      Stored: ${storedDb}, Actual: ${allRecords.length}`);
        console.log(`      Difference: ${allRecords.length - storedDb}`);
      } else {
        console.log(`  ✅ DB Record Count Matches`);
      }

      if (fcmSentRecords !== storedFcm) {
        console.log(`  ⚠️  FCM Count Mismatch:`);
        console.log(`      Stored: ${storedFcm}, Actual FCM records: ${fcmSentRecords}`);
        console.log(`      Difference: ${fcmSentRecords - storedFcm}`);
      } else {
        console.log(`  ✅ FCM Record Count Matches`);
      }
    } else {
      console.log('\n⚠️ This request has no SOS broadcast data.');
    }

    console.log('\n' + '='.repeat(80) + '\n');
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

const args = process.argv.slice(2);

if (args[0] === '--request-id' && args[1]) {
  verifySpecificRequest(args[1]);
} else if (args[0] === '--help') {
  console.log(`
  Usage: node VERIFY_DONOR_COUNT_CONSISTENCY.js [OPTIONS]

  OPTIONS:
    (no args)          Run full verification on all emergency broadcasts
    --request-id ID    Analyze specific request by ID
    --help             Show this help message

  EXAMPLES:
    node VERIFY_DONOR_COUNT_CONSISTENCY.js
    node VERIFY_DONOR_COUNT_CONSISTENCY.js --request-id 5f1a2b3c4d5e6f7g8h9i0j
  `);
} else {
  verifyDonorCounts();
}
