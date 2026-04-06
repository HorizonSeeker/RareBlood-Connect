/**
 * Cleanup Expired Reservations Job
 * 
 * This job runs periodically (every 1 hour) to:
 * 1. Remove expired reservations from BloodInventory
 * 2. Restore units to available count
 * 3. Mark expired requests as CANCELLED
 * 
 * Usage in server.js or scheduler:
 * import { cleanupExpiredReservations } from '@/scripts/cleanup-expired-reservations.js'
 * import cron from 'node-cron'
 * 
 * // Run every hour at minute 0
 * cron.schedule('0 * * * *', cleanupExpiredReservations);
 */

import connectDB from '@/db/connectDB.mjs';
import BloodInventory from '@/models/BloodInventory.js';
import BloodRequest from '@/models/BloodRequest.js';

export async function cleanupExpiredReservations() {
  const jobStartTime = Date.now();
  
  try {
    console.log('\n🧹 Starting expired reservation cleanup job...');
    await connectDB();
    
    const now = new Date();

    // STEP 1: Find all inventories with expired reservations
    const inventoriesToClean = await BloodInventory.find({
      'reservations.expires_at': { $lt: now },
      'reservations.fulfilled_at': null  // Only expired, not fulfilled
    });

    console.log(`📦 Found ${inventoriesToClean.length} inventories with expired reservations`);

    let totalUnitsRestored = 0;
    let totalReservationsRemoved = 0;

    // STEP 2: Process each inventory
    for (const inventory of inventoriesToClean) {
      // Count units to restore
      const expiredReservations = inventory.reservations.filter(
        r => r.expires_at < now && !r.fulfilled_at
      );

      const unitsToRestore = expiredReservations.reduce((sum, r) => sum + r.units, 0);

      // Update inventory: remove expired reservations and restore units
      const updateResult = await BloodInventory.findByIdAndUpdate(
        inventory._id,
        {
          $pull: {
            reservations: {
              expires_at: { $lt: now },
              fulfilled_at: null
            }
          },
          $inc: { units_available: unitsToRestore }
        },
        { new: true }
      );

      totalUnitsRestored += unitsToRestore;
      totalReservationsRemoved += expiredReservations.length;

      console.log(
        `   ✅ Inventory ${inventory._id.toString().slice(0, 8)}: ` +
        `Removed ${expiredReservations.length} reservations, restored ${unitsToRestore} units`
      );

      // STEP 3: Mark corresponding requests as CANCELLED
      for (const reservation of expiredReservations) {
        await BloodRequest.findByIdAndUpdate(
          reservation.request_id,
          {
            $set: {
              status: 'CANCELLED',
              rejection_reason: 'Reservation expired - timeout (24h)'
            }
          }
        );
      }
    }

    // STEP 4: Log summary
    console.log('\n✅ Cleanup completed!');
    console.log(`   • Reservations removed: ${totalReservationsRemoved}`);
    console.log(`   • Units restored: ${totalUnitsRestored}`);
    console.log(`   • Requests cancelled: ${totalReservationsRemoved}`);
    
    const jobDuration = Date.now() - jobStartTime;
    console.log(`   • Job duration: ${jobDuration}ms\n`);

    // ALERT: If job takes too long
    if (jobDuration > 5 * 60 * 1000) {
      console.warn('⚠️  WARNING: Cleanup job took > 5 minutes. Database may need optimization.');
    }

    return {
      success: true,
      reservations_removed: totalReservationsRemoved,
      units_restored: totalUnitsRestored,
      duration_ms: jobDuration
    };

  } catch (error) {
    console.error('❌ Cleanup job error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default cleanupExpiredReservations;
