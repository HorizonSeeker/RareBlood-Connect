#!/usr/bin/env node

/**
 * 🔐 Verify Donor-User Relationship
 * Check if donors are correctly linked to users and have FCM tokens
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

async function checkDonorUserLinks() {
  try {
    console.log('\n' + '═'.repeat(80));
    log('🔐 DONOR-USER RELATIONSHIP ANALYSIS', 'bold');
    console.log('═'.repeat(80) + '\n');

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    log('✅ Connected to MongoDB\n', 'green');

    // Get all donors with populated user data
    const donors = await Doner.find({}).populate('user_id').lean();

    log(`Total Donors: ${donors.length}\n`, 'cyan');

    let validDonors = 0;
    let validForBroadcast = 0;
    let issueList = [];

    // Check each donor
    for (let i = 0; i < donors.length; i++) {
      const donor = donors[i];
      
      log(`\n[${i + 1}/${donors.length}] Donor ID: ${donor._id}`, 'blue');
      log(`Blood Type: ${donor.blood_type}`);
      log(`Active: ${donor.is_active}`);
      log(`Status: ${donor.status}`);

      // Check user link
      if (!donor.user_id) {
        log(`❌ User Link: MISSING (null)`, 'red');
        issueList.push(`Donor ${donor._id}: No user linked`);
        continue;
      }

      const user = donor.user_id;
      
      log(`User ID: ${user._id}`);
      log(`User Name: ${user.name || 'N/A'}`);
      log(`User Email: ${user.email || 'N/A'}`);
      log(`User Role: ${user.role}`);
      
      if (user.role !== 'user') {
        log(`❌ Role: ${user.role} (SHOULD BE 'user')`, 'red');
        issueList.push(`Donor ${donor._id}: User has role '${user.role}' instead of 'user'`);
        continue;
      }

      log(`✅ Role: ${user.role}`, 'green');

      // Check FCM token
      if (!user.fcmToken) {
        log(`⚠️  FCM Token: MISSING`, 'yellow');
        issueList.push(`Donor ${donor._id}: No FCM token (can't notify)`);
        validDonors++;
      } else {
        log(`✅ FCM Token: ${user.fcmToken.substring(0, 20)}...`);
        validDonors++;
        
        // Check if donor has valid location
        if (donor.current_location?.type === 'Point' && donor.current_location?.coordinates?.length === 2) {
          log(`✅ Location: Valid [${donor.current_location.coordinates[0]}, ${donor.current_location.coordinates[1]}]`, 'green');
          validForBroadcast++;
        } else {
          log(`❌ Location: Invalid or missing`, 'red');
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    log('📊 SUMMARY', 'bold');
    console.log('─'.repeat(80));

    log(`\n✅ Valid Donors (correct user link + role): ${validDonors}/${donors.length}`);
    log(`✅ Ready for Broadcast (+ valid FCM + location): ${validForBroadcast}/${donors.length}\n`);

    if (issueList.length > 0) {
      log('❌ ISSUES FOUND:', 'red');
      issueList.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. ${issue}`);
      });

      log('\n💡 SOLUTIONS:', 'yellow');
      log('\n1️⃣  For missing user roles - Fix in User schema:', 'yellow');
      log('   db.users.updateMany({role: {$ne: "user"}}, {$set: {role: "user"}})');

      log('\n2️⃣  For missing FCM tokens - Users need to login/register:', 'yellow');
      log('   Tell donors to open app and accept notifications');

      log('\n3️⃣  For missing user links - Link donors to users:', 'yellow');
      log('   Check if donor.user_id field has correct ObjectId reference');
    } else {
      log('✅ ALL DONORS VALID!', 'green');
    }

    console.log('');
    await mongoose.connection.close();

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

checkDonorUserLinks();
