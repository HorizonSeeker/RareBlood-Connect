/**
 * Verification Script: Auto-Routing SOS Setup
 * Run: node VERIFY_AUTO_ROUTING_SETUP.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Doner from './models/Doner.js';

console.log('📝 Initializing verification script...');

async function verifyAutoRoutingSetup() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // Gắn cứng URI Database
    const myMongoURI = "mongodb+srv://huutaidinh24304_db_user:QDkXc3fcdzgehExs@cluster0.3la9wco.mongodb.net/rareblood?appName=Cluster0";
    
    await mongoose.connect(myMongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    let allChecksPassed = true;

    // Check 1: Blood Bank Locations
    console.log('🔍 Check 1: Blood Bank Locations');
    const bloodBanks = await User.find({ role: 'bloodbank_admin' });
    const banksWithLocation = bloodBanks.filter(b => b.location && b.location.coordinates);
    
    if (bloodBanks.length === 0) {
      console.log('  ❌ FAILED: No blood banks found in DB');
      allChecksPassed = false;
    } else if (banksWithLocation.length === 0) {
      console.log(`  ❌ FAILED: 0/${bloodBanks.length} blood banks have location data`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ PASSED: ${banksWithLocation.length}/${bloodBanks.length} blood banks have location data`);
    }

    // Check 2: Geospatial Indexes
    console.log('\n🔍 Check 2: Geospatial Indexes');
    const userIndexes = await User.collection.getIndexes();
    const hasUserGeoIndex = Object.keys(userIndexes).some(key => key.includes('location'));
    
    if (!hasUserGeoIndex) {
      console.log('  ❌ FAILED: User collection missing 2dsphere index on location');
      allChecksPassed = false;
    } else {
      console.log('  ✅ PASSED: User collection has 2dsphere index');
    }

    const donerIndexes = await Doner.collection.getIndexes();
    const hasDonerGeoIndex = Object.keys(donerIndexes).some(key => key.includes('current_location') || key.includes('location'));
    
    if (!hasDonerGeoIndex) {
      console.log('  ⚠️ WARNING: Doner collection might be missing 2dsphere index (Check if current_location is indexed)');
    } else {
      console.log('  ✅ PASSED: Doner collection has geospatial index');
    }

    // Summary
    console.log('\n=======================================');
    if (allChecksPassed) {
      console.log('🎉 ALL CRITICAL CHECKS PASSED!');
      console.log('🚀 System is ready for Auto-Routing testing.');
    } else {
      console.log('⚠️ SOME CHECKS FAILED!');
      console.log('👉 Please run "node SETUP_BLOOD_BANK_LOCATIONS.js" first.');
    }
    console.log('=======================================\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📌 MongoDB connection closed');
  }
}

// Run verify
verifyAutoRoutingSetup();