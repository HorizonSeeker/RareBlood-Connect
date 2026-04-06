/**
 * Fix existing test donors - ensure is_active=true
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../db/connectDB.mjs";
import Doner from "../models/Doner.js";

dotenv.config();

async function fixDonors() {
  try {
    await connectDB();
    
    console.log("🔧 Fixing test donors...");
    
    // Update all test donors to be active
    const result = await Doner.updateMany(
      {},
      {
        $set: {
          is_active: true,
          status: 'active'
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} donors`);
    console.log(`   - Set is_active: true`);
    console.log(`   - Set status: active`);
    
    // Verify
    const active = await Doner.countDocuments({ is_active: true });
    const withFCM = await Doner.countDocuments({ fcmToken: { $exists: true, $ne: null } });
    
    console.log(`\n✅ Active donors: ${active}`);
    console.log(`✅ Donors with FCM: ${withFCM}`);
    
    // Test geo query again
    const found = await Doner.findOne(
      {
        is_active: true,
        fcmToken: { $exists: true, $ne: null },
        current_location: { $exists: true, $ne: null }
      }
    );
    
    if (found) {
      console.log(`✅ Sample donor found:`, {
        blood_type: found.blood_type,
        location: found.current_location?.coordinates,
        fcmToken: found.fcmToken?.substring(0, 20) + '...'
      });
    }

  } catch (error) {
    console.error("❌ Fix error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

fixDonors();
