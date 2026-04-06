/**
 * Verify Geospatial Setup
 * Checks:
 * 1. Doner model has 2dsphere index
 * 2. BloodRequest has proper schema for emergency flow
 * 3. Test donor data exists
 * 4. Sample geospatial query works
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../db/connectDB.mjs";
import Doner from "../models/Doner.js";
import BloodRequest from "../models/BloodRequest.js";

dotenv.config();

async function verifySetup() {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB\n");

    // Check 1: Verify 2dsphere index on Doner
    console.log("📍 Check 1: Verifying 2dsphere index...");
    const donorIndexes = await Doner.collection.getIndexes();
    const has2dsphere = Object.values(donorIndexes).some(idx => 
      Object.values(idx.key || {}).some(v => v === '2dsphere')
    );

    if (has2dsphere) {
      console.log("✅ 2dsphere index exists on Doner model");
      console.log("   Indexes found:", Object.keys(donorIndexes));
    } else {
      console.log("❌ 2dsphere index NOT found - creating...");
      await Doner.collection.createIndex({ current_location: '2dsphere' });
      console.log("✅ 2dsphere index created successfully");
    }

    // Check 2: Verify BloodRequest schema
    console.log("\n📋 Check 2: Verifying BloodRequest schema...");
    const schema = BloodRequest.schema;
    
    const hasBloodBankId = schema.paths.bloodbank_id;
    console.log(`  bloodbank_id field: ${hasBloodBankId ? '✅' : '❌'}`);
    console.log(`    - Required: ${hasBloodBankId?.isRequired ? 'YES (fix needed!)' : '❌ Optional (correct!)'}`);
    
    const hasStatus = schema.paths.status;
    if (hasStatus) {
      const enums = hasStatus.enumValues || [];
      console.log(`  status enum: ${enums.includes('IN_PROGRESS') ? '✅' : '❌'}`);
      console.log(`    - Values: ${enums.join(', ')}`);
    }

    // Check 3: Test donor data
    console.log("\n👥 Check 3: Checking test donor data...");
    const donorCount = await Doner.countDocuments({});
    const activeDonors = await Doner.countDocuments({ is_active: true });
    const donorsWithFCM = await Doner.countDocuments({ fcmToken: { $exists: true, $ne: null } });

    console.log(`  Total donors: ${donorCount}`);
    console.log(`  Active donors: ${activeDonors} ✅`);
    console.log(`  Donors with FCM token: ${donorsWithFCM} ✅`);

    if (donorCount === 0) {
      console.log("\n⚠️  No test donors found. Run: node scripts/seed-test-donors.js");
    }

    // Check 4: Test geospatial query
    console.log("\n🔍 Check 4: Testing geospatial query...");
    
    // Ha Noi center coordinates
    const testLat = 21.0285;
    const testLong = 105.8542;
    const testRadius = 5000; // 5km

    const result = await Doner.find(
      {
        is_active: true,
        fcmToken: { $exists: true, $ne: null },
        current_location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [testLong, testLat]
            },
            $maxDistance: testRadius
          }
        }
      },
      { blood_type: 1, current_location: 1, mobile_number: 1 }
    ).limit(5).lean();

    console.log(`  Query test: ${result.length > 0 ? '✅' : '⚠️'} Found ${result.length} donors`);
    
    if (result.length > 0) {
      console.log(`  Sample results:`);
      result.forEach((donor, idx) => {
        const dist = ((donor.current_location?.coordinates || [0, 0])[0] * 111) || '?';
        console.log(`    ${idx + 1}. ${donor.blood_type} at ${donor.current_location?.coordinates}`);
      });
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("✅ EMERGENCY FLOW READY!" + (donorCount > 0 ? " 🚀" : " (needs test data)"));
    console.log("=".repeat(50));

    console.log("\n📝 Next Steps:");
    console.log("  1. If no test donors: node scripts/seed-test-donors.js");
    console.log("  2. Test emergency request:");
    console.log("     POST http://localhost:3000/api/requests");
    console.log("     {");
    console.log('       "blood_type": "O+",');
    console.log('       "units_required": 5,');
    console.log("       \"latitude\": 21.0285,");
    console.log("       \"longitude\": 105.8542,");
    console.log('       "search_radius_km": 5');
    console.log("     }");
    console.log("  3. Monitor server logs for [Geospatial Search] and FCM notifications");

  } catch (error) {
    console.error("❌ Verification error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

verifySetup();
