#!/usr/bin/env node

/**
 * Setup Test Environment for Emergency API
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Creates a test hospital user
 * 3. Creates 20 test donors in HCM area
 * 4. Outputs the user ID for testing
 * 
 * Usage:
 * node SETUP_TEST_ENV.js
 */

import connectDB from './db/connectDB.mjs';
import User from './models/User.js';
import Doner from './models/Doner.js';

console.log('🔧 Setting up test environment...\n');

try {
  // Connect to database
  console.log('📡 Connecting to MongoDB...');
  await connectDB();
  console.log('✅ Connected\n');

  // Create or get test hospital user
  console.log('👤 Setting up test hospital user...');
  let testUser = await User.findOne({ email: 'emergency@test.com' });
  
  if (!testUser) {
    testUser = await User.create({
      name: 'Test Emergency Hospital',
      email: 'emergency@test.com',
      password: 'hashed_password_123', // In real scenario, this would be hashed
      role: 'hospital',
      phone: '0987654321',
      location: 'Ho Chi Minh City',
      verified: true,
      status: 'active'
    });
    console.log(`✅ Created new test user: ${testUser._id}`);
  } else {
    console.log(`✅ Test user already exists: ${testUser._id}`);
  }

  // Create 20 test donors (if not already created)
  console.log('\n🩸 Setting up 20 test donors in HCM area...');
  const existingDonors = await Doner.countDocuments({ 
    // Use some marker to identify test donors
    email: /test-donor.*@example\.com/i 
  });

  if (existingDonors < 20) {
    const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const donors = [];

    for (let i = 1; i <= 20; i++) {
      donors.push({
        name: `Test Donor ${i}`,
        email: `test-donor-${i}@example.com`,
        phone: `090${String(i).padStart(7, '0')}`,
        blood_type: bloodTypes[i % 8],
        age: 25 + (i % 30),
        gender: i % 2 === 0 ? 'M' : 'F',
        is_active: true,
        status: 'active',
        last_donation_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        eligible_for_donation: true,
        current_location: {
          type: 'Point',
          coordinates: [
            106.6814 + (Math.random() - 0.5) * 0.02,  // HCM longitude ± ~1km
            10.8577 + (Math.random() - 0.5) * 0.02    // HCM latitude ± ~1km
          ]
        },
        fcmToken: `fcm_token_test_donor_${i}_${Date.now()}`,
        preferences: {
          notification_enabled: true,
          emergency_requests: true
        }
      });
    }

    await Doner.insertMany(donors, { ordered: false });
    console.log(`✅ Created 20 test donors`);
  } else {
    console.log(`✅ Test donors already exist (${existingDonors} found)`);
  }

  // Log results
  console.log('\n✨ Test environment ready!\n');
  console.log('📋 Test Configuration:');
  console.log(`   User ID: ${testUser._id}`);
  console.log(`   Email: ${testUser.email}`);
  console.log(`   Role: ${testUser.role}`);
  console.log(`   Donors in HCM: 20 (diverse blood types)`);
  console.log(`\n🧪 Ready for testing!`);
  console.log(`\n   Run: node TEST_EMERGENCY_API.js`);
  
  process.exit(0);
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}
