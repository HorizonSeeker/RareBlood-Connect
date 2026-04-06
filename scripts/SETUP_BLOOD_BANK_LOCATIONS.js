/**
 * Setup Script: Add Location Data to Blood Bank Test Accounts
 * * Purpose:
 * - Populates GeoJSON location field for blood bank accounts (bloodbank_admin role)
 * - Enables $near geospatial queries for auto-routing feature
 * - Creates sample blood banks with realistic location data (Vietnam cities)
 * * Usage:
 * node SETUP_BLOOD_BANK_LOCATIONS.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for dotenv path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📝 Initializing script...');
// Bỏ qua cái dotenv lằng nhằng luôn cho lẹ, vì mình dùng link cứng rồi.

// Sample blood bank locations (Vietnam)
// Format: { name, email, longitude, latitude, address }
const SAMPLE_BLOOD_BANKS = [
  {
    name: 'Hồng Phát Blood Bank',
    email: 'hongphat@bloodbank.vn',
    longitude: 106.6979,
    latitude: 10.7769,
    address: '123 Nguyễn Huệ, Ho Chi Minh City'
  },
  {
    name: 'Bắc Giang Blood Center',
    email: 'bacgiang@bloodcenter.vn',
    longitude: 106.1944,
    latitude: 21.2789,
    address: '456 Tô Hiệu, Bac Giang City'
  },
  {
    name: 'Hà Nội Central Blood Bank',
    email: 'hanoi@bloodbank.vn',
    longitude: 105.8342,
    latitude: 21.0285,
    address: '789 Lê Thanh Tông, Hanoi'
  },
  {
    name: 'Đà Nẵng Regional Blood Bank',
    email: 'danang@bloodbank.vn',
    longitude: 107.5679,
    latitude: 16.0473,
    address: '321 Nguyễn Văn Linh, Da Nang'
  },
  {
    name: 'Cần Thơ Blood Center',
    email: 'cantho@bloodcenter.vn',
    longitude: 105.7845,
    latitude: 10.0456,
    address: '654 Hùng Vương, Can Tho City'
  }
];

async function setupBloodBankLocations() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // Gắn cứng URI Database
    const myMongoURI = "mongodb+srv://huutaidinh24304_db_user:QDkXc3fcdzgehExs@cluster0.3la9wco.mongodb.net/rareblood?appName=Cluster0";
    console.log(`   URI: ${myMongoURI.substring(0, 50)}...`);
    
    await mongoose.connect(myMongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Find all existing blood bank accounts
    console.log('📋 Step 1: Finding existing blood bank accounts...');
    const existingBanks = await User.find({ role: 'bloodbank_admin' })
      .select('_id name email phone address location');
    
    console.log(`   Found ${existingBanks.length} blood bank accounts\n`);

    if (existingBanks.length === 0) {
      console.log('⚠️  No blood bank accounts found in database');
      console.log('   Please create blood bank accounts first\n');
      
      console.log('📝 Creating sample blood bank accounts...');
      const createdBanks = [];
      
      for (const bankData of SAMPLE_BLOOD_BANKS) {
        const newBank = new User({
          name: bankData.name,
          email: bankData.email,
          password: '$2b$10$dummyhashedpassword', // Dummy password (don't use in production)
          phone: '0900-123456',
          address: bankData.address,
          role: 'bloodbank_admin',
          isRegistrationComplete: true,
          location: {
            type: 'Point',
            coordinates: [bankData.longitude, bankData.latitude],
            address: bankData.address
          }
        });
        
        try {
          await newBank.save();
          createdBanks.push(newBank);
          console.log(`   ✅ Created: ${bankData.name} ([${bankData.longitude}, ${bankData.latitude}])`);
        } catch (err) {
          if (err.code === 11000) {
            console.log(`   ⚠️  Skipped: ${bankData.email} (already exists)`);
          } else {
            console.error(`   ❌ Error creating ${bankData.name}:`, err.message);
          }
        }
      }
      
      console.log(`\n✅ Created ${createdBanks.length} new blood bank accounts\n`);
    }

    // Step 2: Update all blood bank locations with sample data
    console.log('📍 Step 2: Updating blood bank locations...');
    let updateCount = 0;
    
    const banksToUpdate = await User.find({ role: 'bloodbank_admin' });
    
    for (let i = 0; i < banksToUpdate.length; i++) {
      const bank = banksToUpdate[i];
      
      // If no location data, assign from sample banks
      if (!bank.location || !bank.location.coordinates || bank.location.coordinates.length === 0) {
        const sampleBank = SAMPLE_BLOOD_BANKS[i % SAMPLE_BLOOD_BANKS.length];
        
        bank.location = {
          type: 'Point',
          coordinates: [sampleBank.longitude, sampleBank.latitude],
          address: bank.address || sampleBank.address
        };
        
        await bank.save();
        updateCount++;
        console.log(`   ✅ Updated: ${bank.name} → [${bank.location.coordinates[0]}, ${bank.location.coordinates[1]}]`);
      } else {
        console.log(`   ℹ️  Already has location: ${bank.name}`);
      }
    }
    
    console.log(`\n✅ Updated ${updateCount} blood bank locations\n`);

    // Step 3: Verify geospatial index
    console.log('🗺️  Step 3: Verifying geospatial index...');
    const indexes = await User.collection.getIndexes();
    const hasGeoIndex = Object.keys(indexes).some(key => key.includes('location'));
    
    if (hasGeoIndex) {
      console.log('   ✅ Geospatial index exists\n');
    } else {
      console.log('   ℹ️  Creating geospatial index (2dsphere)...');
      await User.collection.createIndex({ location: '2dsphere' });
      console.log('   ✅ Geospatial index created\n');
    }

    // Step 4: Display all configured blood banks
    console.log('📊 Step 4: All Configured Blood Banks:\n');
    const allBanks = await User.find({ role: 'bloodbank_admin' })
      .select('name email phone location -_id');
    
    console.log('┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Blood Bank Name               │ Email              │ Location (Lon, Lat) │');
    console.log('├─────────────────────────────────────────────────────────────────────────┤');
    
    allBanks.forEach(bank => {
      const coords = bank.location?.coordinates ? 
        `[${bank.location.coordinates[0].toFixed(4)}, ${bank.location.coordinates[1].toFixed(4)}]` :
        'NO LOCATION';
      const name = bank.name.padEnd(30);
      const email = (bank.email || 'N/A').padEnd(18);
      console.log(`│ ${name} │ ${email} │ ${coords} │`);
    });
    
    console.log('└─────────────────────────────────────────────────────────────────────────┘\n');

    // Step 5: Test geospatial query
    console.log('🧪 Step 5: Testing $near geospatial query...');
    
    // Test point: Hospital at Ho Chi Minh City center
    const testHospitalLocation = {
      longitude: 106.6979,
      latitude: 10.7769
    };
    
    console.log(`   Test hospital location: [${testHospitalLocation.longitude}, ${testHospitalLocation.latitude}]\n`);
    
    const nearbyBanks = await User.find({
      role: 'bloodbank_admin',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [testHospitalLocation.longitude, testHospitalLocation.latitude]
          },
          $maxDistance: 100000  // 100km
        }
      }
    }).select('name location phone -_id');
    
    if (nearbyBanks.length > 0) {
      console.log(`   ✅ Found ${nearbyBanks.length} blood banks within 100km:\n`);
      nearbyBanks.forEach((bank, idx) => {
        console.log(`   ${idx + 1}. ${bank.name} - [${bank.location.coordinates[0]}, ${bank.location.coordinates[1]}]`);
      });
    } else {
      console.log('   ❌ No blood banks found in test query');
      console.log('   ⚠️  Possible issue: Location data not properly indexed');
    }

    console.log('\n✅ Setup completed successfully!\n');
    console.log('🚀 You can now test auto-routing with geospatial queries.\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📌 MongoDB connection closed');
  }
}

// Run setup
setupBloodBankLocations();