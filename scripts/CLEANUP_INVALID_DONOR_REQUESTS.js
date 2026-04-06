/**
 * Cleanup Script: Remove erroneous DonorContactRequest records
 * 
 * BEFORE RUNNING:
 * - Backup your MongoDB database
 * - Update the connection string if needed
 * - Run: node CLEANUP_INVALID_DONOR_REQUESTS.js
 */

import mongoose from 'mongoose';
import connectDB from '@/db/connectDB.mjs';
import DonorContactRequest from '@/models/DonorContactRequest.js';

async function cleanupInvalidRequests() {
  try {
    console.log('🗑️  Starting cleanup of invalid DonorContactRequest records...\n');

    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Find all records with null/undefined donorId
    console.log('🔍 Finding records with null donorId...');
    const nullDonorRequests = await DonorContactRequest.find({ donorId: null });
    console.log(`   Found ${nullDonorRequests.length} records with null donorId`);

    if (nullDonorRequests.length > 0) {
      console.log('\n❌ Sample of invalid records:');
      nullDonorRequests.slice(0, 3).forEach(req => {
        console.log(`   _id: ${req._id}`);
        console.log(`   donorId: ${req.donorId} (NULL)`);
        console.log(`   hospitalId: ${req.hospitalId}`);
        console.log(`   bloodbankId: ${req.bloodbankId}`);
        console.log(`   status: ${req.status}`);
        console.log('   ---');
      });
    }

    // Find records with missing hospitalId
    console.log('\n🔍 Finding records with missing hospitalId...');
    const noHospitalRequests = await DonorContactRequest.find({ 
      hospitalId: { $in: [null, undefined] } 
    });
    console.log(`   Found ${noHospitalRequests.length} records with null hospitalId`);

    // Find records with missing bloodbankId
    console.log('\n🔍 Finding records with missing bloodbankId...');
    const noBloodBankRequests = await DonorContactRequest.find({ 
      bloodbankId: { $in: [null, undefined] } 
    });
    console.log(`   Found ${noBloodBankRequests.length} records with null bloodbankId`);

    // Delete null donorId records
    if (nullDonorRequests.length > 0) {
      console.log(`\n🗑️  Deleting ${nullDonorRequests.length} records with null donorId...`);
      const deleteResult = await DonorContactRequest.deleteMany({ donorId: null });
      console.log(`   ✅ Deleted: ${deleteResult.deletedCount} records`);
    }

    // Delete records with null hospitalId and null donorId
    console.log(`\n🗑️  Deleting ${noHospitalRequests.length} records with null hospitalId...`);
    const deleteResult2 = await DonorContactRequest.deleteMany({ 
      hospitalId: { $in: [null, undefined] },
      donorId: null  // Only delete if both are null
    });
    console.log(`   ✅ Deleted: ${deleteResult2.deletedCount} records`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    const totalRecords = await DonorContactRequest.countDocuments();
    const validRecords = await DonorContactRequest.countDocuments({ 
      donorId: { $ne: null },
      hospitalId: { $ne: null }
    });

    console.log(`Total Records in DB: ${totalRecords}`);
    console.log(`Valid Records: ${validRecords}`);
    console.log(`Invalid Records Remaining: ${totalRecords - validRecords}`);
    console.log('='.repeat(60));

    console.log('\n✅ Cleanup complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run cleanup
cleanupInvalidRequests();
