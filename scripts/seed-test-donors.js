/**
 * Seed Test Donors - HCM Area
 * Creates 20 test donors around HCM (10.8577, 106.6814)
 * for emergency blood request testing
 * 
 * Usage: node scripts/seed-test-donors.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../db/connectDB.mjs";
import User from "../models/User.js";
import Doner from "../models/Doner.js";

dotenv.config();

// HCM Base coordinates
const HCM_CENTER = { lat: 10.8577, long: 106.6814 };

// All blood types - balanced distribution
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

// Sample Vietnamese donor names
const DONOR_NAMES = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Phạm Văn Cường', 'Hoàng Thị Dung', 'Vũ Văn Em',
  'Ngô Thị Hằng', 'Lê Văn Khoa', 'Đặng Thị Long', 'Bùi Văn Minh', 'Dương Thị Ngọc',
  'Cao Văn Phúc', 'Nông Thị Quyên', 'Rơ Vạn Rui', 'Sơn Thị Sa', 'Tạ Văn Tâm'
];

// HCM Districts (realistic distribution)
const DISTRICTS = [
  'Q.1 - Ben Thanh',
  'Q.3 - Vo Van Tan',
  'Q.4 - Nguyen Hue',
  'Q.5 - Binh Khanh',
  'Q.7 - Phu My Hung',
  'Q.Binh Thanh - Thu Duc',
  'Q.Tan Binh - Tan Phu',
  'Q.Go Vap - Binh Tan'
];

async function seedHCMDonors() {
  try {
    await connectDB();
    console.log("✅ Connected to database\n");

    // Check if test HCM donors already exist
    const existingCount = await Doner.countDocuments({ 
      address: { $regex: 'HCM Test|Ho Chi Minh' }
    });
    
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing HCM test donors`);
      console.log(`   Clear with: db.donors.deleteMany({ address: { $regex: 'HCM Test' } })`);
      return;
    }

    const donors = [];
    console.log("📝 Creating 20 HCM test donors...\n");

    // Create 20 donors
    for (let i = 0; i < 20; i++) {
      const bloodType = BLOOD_TYPES[i % BLOOD_TYPES.length];
      const nameIdx = i % DONOR_NAMES.length;
      const districtIdx = Math.floor(i / 3) % DISTRICTS.length;
      const district = DISTRICTS[districtIdx];

      // Create test user
      let userId;
      const userEmail = `hcm-donor-${String(i).padStart(2, '0')}@rareblood.test`;
      
      let testUser = await User.findOne({ email: userEmail });
      if (!testUser) {
        testUser = await User.create({
          name: `${DONOR_NAMES[nameIdx]} (${bloodType})`,
          email: userEmail,
          phone: `090${String(6000000 + i).padStart(7, '0')}`,
          password: 'test123',
          role: 'user',
          is_email_verified: true,
          registration_completed: true
        });
      }
      userId = testUser._id;

      // Generate coordinates around HCM center with realistic variation
      // Each degree ≈ 111 km, so 0.01 degree ≈ 1.1 km
      const latVariation = (Math.random() - 0.5) * 0.02; // ±1.1 km
      const longVariation = (Math.random() - 0.5) * 0.02; // ±1.1 km

      donors.push({
        user_id: userId,
        age: 22 + (i % 40),
        blood_type: bloodType,
        mobile_number: `090${String(6000000 + i).padStart(7, '0')}`,
        weight: 55 + (i % 30),
        emergency_contact_mobile: `091${String(6000000 + i).padStart(7, '0')}`,
        address: `${district}, HCM Test Donor #${String(i + 1).padStart(2, '0')}`,
        medicalProofUrl: 'https://example.com/medical-proof.jpg',
        verification_status: 'VERIFIED',
        is_active: true,
        status: 'active',
        is_critical_ready: Math.random() > 0.5,
        donation_count: 3 + (i % 8),
        total_donations: 3 + (i % 8),
        current_location: {
          type: 'Point',
          coordinates: [
            HCM_CENTER.long + longVariation,  // [longitude, latitude]
            HCM_CENTER.lat + latVariation
          ]
        },
        fcmToken: `hcm-fcm-${String(i).padStart(2, '0')}-${Math.random().toString(36).substring(2, 15)}`,
        last_donation_date: new Date(Date.now() - (65 + i * 2) * 24 * 60 * 60 * 1000), // 65-100 days ago
        created_at: new Date()
      });

      console.log(`  ${String(i + 1).padStart(2, '0')}. ${bloodType.padEnd(3)} | ${district.padEnd(30)} | FCM ✅`);
    }

    // Insert all donors
    console.log();
    const insertedDonors = await Doner.insertMany(donors);
    console.log(`✅ Seeded ${insertedDonors.length} donors to HCM area\n`);
    
    // Verify 2dsphere index
    console.log("📍 Verifying 2dsphere index...");
    const indexes = await Doner.collection.getIndexes();
    const has2dsphere = Object.values(indexes).some(idx => 
      Object.values(idx.key || {}).some(v => v === '2dsphere')
    );
    
    if (has2dsphere) {
      console.log("✅ 2dsphere index verified\n");
    } else {
      console.log("Creating 2dsphere index...");
      await Doner.collection.createIndex({ current_location: '2dsphere' });
      console.log("✅ 2dsphere index created\n");
    }

    // Print summary
    console.log("📊 Summary:");
    const stats = {
      'O+': insertedDonors.filter(d => d.blood_type === 'O+').length,
      'O-': insertedDonors.filter(d => d.blood_type === 'O-').length,
      'A+': insertedDonors.filter(d => d.blood_type === 'A+').length,
      'Other': insertedDonors.length - 
               insertedDonors.filter(d => ['O+', 'O-', 'A+'].includes(d.blood_type)).length
    };
    
    console.log(`  O+: ${stats['O+']} | O-: ${stats['O-']} | A+: ${stats['A+']} | Others: ${stats['Other']}`);
    console.log(`  All is_active: true ✅`);
    console.log(`  All have FCM tokens ✅`);
    console.log(`  Last donation: 65-100 days ago ✅\n`);

    // Sample query test
    console.log("🔍 Testing geospatial query...");
    const foundDonors = await Doner.find({
      is_active: true,
      fcmToken: { $exists: true, $ne: null },
      current_location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [HCM_CENTER.long, HCM_CENTER.lat]
          },
          $maxDistance: 5000 // 5km
        }
      }
    }).limit(5).lean();

    console.log(`✅ Found ${foundDonors.length} donors within 5km\n`);

    console.log("=" .repeat(60));
    console.log("✅ READY FOR TESTING!");
    console.log("=".repeat(60));
    console.log("\n📝 Test Emergency Request:");
    console.log(`\nPOST http://localhost:3000/api/requests`);
    console.log(`Authorization: Bearer <TOKEN>\n`);
    console.log(JSON.stringify({
      blood_type: "O+",
      units_required: 5,
      latitude: HCM_CENTER.lat,
      longitude: HCM_CENTER.long,
      search_radius_km: 5,
      urgency_level: "CRITICAL",
      emergency_contact_name: "Test User",
      emergency_contact_mobile: "0901234567"
    }, null, 2));

    console.log("\n✅ Expected: status=IN_PROGRESS, bloodbank_id=null");
    console.log("✅ Server logs should show:\n");
    console.log("   🩸 [Blood Compatibility] Request: O+ → Compatible donors: O+, O-");
    console.log(`   ✅ Found X nearby donors with O+ blood`);
    console.log("   ✅ FCM sent: Y success, Z failed");

  } catch (error) {
    console.error("❌ Seed error:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Run seed
seedHCMDonors();
