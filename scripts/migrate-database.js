#!/usr/bin/env node

/**
 * MongoDB Migration Script
 * Run: node scripts/migrate-database.js
 * 
 * This script updates existing documents to be compatible with the new schema
 * and creates necessary indexes for performance.
 */

import mongoose from 'mongoose';
import connectDB from '../db/connectDB.mjs';
import BloodRequest from '../models/BloodRequest.js';
import BloodInventory from '../models/BloodInventory.js';
import Doner from '../models/Doner.js';

async function runMigrations() {
  try {
    console.log('📝 Starting MongoDB Migration...\n');
    
    await connectDB();
    console.log('✅ Connected to database\n');

    // STEP 1: Migrate BloodRequest documents
    console.log('1️⃣ Migrating BloodRequest collection...');
    const requestUpdateResult = await BloodRequest.updateMany(
      {
        $or: [
          { status: "pending" },
          { status: { $exists: false } }
        ]
      },
      {
        $set: {
          status: "IN_REVIEW",
          urgency_level: "MEDIUM",
          geosearch_triggered: false,
          search_radius_km: 10
        }
      }
    );
    console.log(`   ✅ Updated ${requestUpdateResult.modifiedCount} blood requests`);

    // STEP 2: Migrate BloodInventory documents
    console.log('\n2️⃣ Migrating BloodInventory collection...');
    const inventoryUpdateResult = await BloodInventory.updateMany(
      { reservations: { $exists: false } },
      {
        $set: { 
          reservations: [],
          last_updated: new Date()
        }
      }
    );
    console.log(`   ✅ Updated ${inventoryUpdateResult.modifiedCount} inventory records`);

    // STEP 3: Migrate Donor documents
    console.log('\n3️⃣ Migrating Donor collection...');
    const donorUpdateResult = await Doner.updateMany(
      {
        $or: [
          { is_active: { $exists: false } },
          { status: { $exists: false } },
          { last_donation_date: { $exists: false } }
        ]
      },
      {
        $set: {
          is_active: { $cond: ['$is_critical_ready', true, true] },
          status: 'active',
          last_donation_date: null
        }
      }
    );
    console.log(`   ✅ Updated ${donorUpdateResult.modifiedCount} donor records`);

    // STEP 4: Create Indexes
    console.log('\n4️⃣ Creating database indexes...');
    
    // BloodRequest indexes
    await BloodRequest.collection.createIndex({ status: 1 });
    await BloodRequest.collection.createIndex({ requested_date: -1 });
    await BloodRequest.collection.createIndex({ requested_by_hospital: 1, status: 1 });
    await BloodRequest.collection.createIndex({ bloodbank_id: 1, status: 1 });
    await BloodRequest.collection.createIndex({ blood_type: 1, status: 1 });
    console.log('   ✅ BloodRequest indexes created');
    
    // BloodInventory indexes
    await BloodInventory.collection.createIndex({ 
      bloodbank_id: 1, 
      blood_type: 1, 
      expiry_date: 1 
    });
    console.log('   ✅ BloodInventory indexes created');
    
    // Donor indexes - CRITICAL for GeoJSON queries
    await Doner.collection.createIndex({ current_location: '2dsphere' });
    await Doner.collection.createIndex({ 
      blood_type: 1, 
      current_location: '2dsphere', 
      is_active: 1, 
      fcmToken: 1 
    });
    await Doner.collection.createIndex({ blood_type: 1 });
    await Doner.collection.createIndex({ is_active: 1 });
    await Doner.collection.createIndex({ fcmToken: 1 });
    console.log('   ✅ Donor indexes created (including GeoJSON 2dsphere)');

    // STEP 5: Verify indexes
    console.log('\n5️⃣ Verifying indexes...');
    const bloodRequestIndexes = await BloodRequest.collection.getIndexes();
    const bloodInventoryIndexes = await BloodInventory.collection.getIndexes();
    const donorIndexes = await Doner.collection.getIndexes();
    
    console.log(`   ✅ BloodRequest has ${Object.keys(bloodRequestIndexes).length} indexes`);
    console.log(`   ✅ BloodInventory has ${Object.keys(bloodInventoryIndexes).length} indexes`);
    console.log(`   ✅ Donor has ${Object.keys(donorIndexes).length} indexes`);
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • BloodRequest documents updated: ${requestUpdateResult.modifiedCount}`);
    console.log(`   • BloodInventory documents updated: ${inventoryUpdateResult.modifiedCount}`);
    console.log(`   • Donor documents updated: ${donorUpdateResult.modifiedCount}`);
    console.log(`   • All required indexes created\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  }
}

runMigrations();
