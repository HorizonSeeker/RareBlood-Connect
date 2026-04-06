#!/usr/bin/env node

/**
 * Script to update all users with role = "donor" to role = "user"
 * 
 * How to run:
 * node UPDATE_DONOR_ROLE_TO_USER.js
 */

import connectDB from "./db/connectDB.mjs";
import User from "./models/User.js";

async function updateDonorRoles() {
  try {
    await connectDB();
    console.log("✅ Database connected\n");

    // Find all users with role = "donor"
    const donorUsers = await User.find({ role: "donor" });
    console.log(`📊 Found ${donorUsers.length} users with role = "donor"\n`);

    if (donorUsers.length === 0) {
      console.log("✅ No users with role = 'donor' found. Database is already clean!");
      process.exit(0);
    }

    // Show sample of users before update
    console.log("📋 Sample of users to be updated:");
    donorUsers.slice(0, 3).forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.name})`);
    });
    if (donorUsers.length > 3) {
      console.log(`   ... and ${donorUsers.length - 3} more users\n`);
    }

    // Update all "donor" roles to "user"
    console.log("🔄 Updating roles from 'donor' to 'user'...\n");
    const result = await User.updateMany(
      { role: "donor" },
      { $set: { role: "user" } }
    );

    console.log("✅ Update completed!");
    console.log(`   • Modified: ${result.modifiedCount} users`);
    console.log(`   • Matched: ${result.matchedCount} users`);

    if (result.modifiedCount > 0) {
      // Verify the update
      const verifyDonor = await User.countDocuments({ role: "donor" });
      const verifyUser = await User.countDocuments({ role: "user" });
      
      console.log("\n📊 Verification:");
      console.log(`   • Users with role = 'donor': ${verifyDonor}`);
      console.log(`   • Users with role = 'user': ${verifyUser}`);
      
      if (verifyDonor === 0) {
        console.log("\n✅ All donor roles successfully converted to user role!");
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

updateDonorRoles();
