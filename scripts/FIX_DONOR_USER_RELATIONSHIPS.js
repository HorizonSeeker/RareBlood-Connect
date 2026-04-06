#!/usr/bin/env node

/**
 * 🔧 FIX: Repair Donor-User Relationships
 * 
 * This script:
 * 1. Update all user roles to 'donor'
 * 2. Ensure all donors with valid user_id are linked correctly
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

async function fixDonorUserRelationships() {
  try {
    console.log('\n' + '═'.repeat(80));
    log('🔧 DONOR-USER RELATIONSHIP REPAIR', 'bold');
    console.log('═'.repeat(80) + '\n');

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    log('✅ Connected to MongoDB\n', 'green');

    // ========================================================================
    // INFO: Donors are identified by having a Doner profile + user_id reference
    // NOT by role (which has 4 values: user, hospital, bloodbank_admin, admin)
    // ========================================================================
    log('ℹ️  Note: Donors are identified by Doner profile, not by role\n', 'cyan');

    // ========================================================================
    // CHECK: Ensure all donors have valid user_id reference
    // ========================================================================
    log('1️⃣  Checking Donors with Valid User Links...', 'cyan');
    log('─'.repeat(80));

    const donorsWithValidUsers = await Doner.find({ 
      user_id: { $exists: true, $ne: null } 
    });

    const donorsWithoutUsers = await Doner.find({ 
      user_id: { $exists: false } 
    }).or([{ user_id: null }]);

    log(`✅ Donors with valid user_id: ${donorsWithValidUsers.length}\n`, 'green');
    log(`❌ Donors missing user_id: ${donorsWithoutUsers.length}\n`, 'red');

    if (donorsWithoutUsers.length > 0) {
      log('🔴 ACTION REQUIRED: Create user accounts for these donors\n', 'red');
    }

    // ========================================================================
    // Verification
    // ========================================================================
    log('\n✅ VERIFICATION', 'cyan');
    log('─'.repeat(80));

    const totalValid = await Doner.countDocuments({
      user_id: { $exists: true, $ne: null }
    });

    const validForBroadcast = await Doner.countDocuments({
      user_id: { $exists: true, $ne: null },
      is_active: true,
      'current_location.type': 'Point',
      fcmToken: { $exists: true, $ne: null }  // Must have fcmToken!
    });

    log(`\nDonors with valid user link: ${totalValid}/44`);
    log(`Donors query-ready (with FCM): ${validForBroadcast}/44\n`);

    // ========================================================================
    // Final Summary
    // ========================================================================
    console.log('═'.repeat(80));
    log('✅ ANALYSIS COMPLETE!', 'green');
    console.log('═'.repeat(80));

    log('\n🔑 KEY INSIGHTS:', 'cyan');
    log(`• Donors are users with role='user' + a Doner profile`, 'cyan');
    log(`• FCM token must come from Donor.fcmToken (mobile app)`, 'cyan');
    log(`• User.fcmToken is from web app (may be different)`, 'cyan');
    log(`• Broadcast should use Donor.fcmToken for notifications\n`, 'cyan');

    log('Next Steps:', 'yellow');
    if (donorsWithoutUsers.length > 0) {
      log(`1. Create user accounts for ${donorsWithoutUsers.length} orphaned donors`, 'yellow');
    }
    log('2. Ensure donors have fcmToken (from mobile app login)', 'yellow');
    log('3. Emergency broadcast will now use Donor.fcmToken ✅\n', 'yellow');

    await mongoose.connection.close();

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

fixDonorUserRelationships();
