/**
 * ✅ VERIFICATION SCRIPT: Check Auto-Routing After Rejection
 * Run: node VERIFY_AUTO_ROUTING.js
 */

import connectDB from './db/connectDB.mjs';
import HospitalRequest from './models/HospitalRequest.js';
import mongoose from 'mongoose';

async function verifyAutoRouting() {
  try {
    await connectDB();
    console.log('\n' + '═'.repeat(80));
    console.log('✅ AUTO-ROUTING VERIFICATION');
    console.log('═'.repeat(80) + '\n');

    // Find emergency requests that were rejected
    const emergencyRequests = await HospitalRequest.find({
      is_emergency: true
    }).sort({ created_at: -1 }).limit(5);

    if (emergencyRequests.length === 0) {
      console.log('❌ No emergency requests found with is_emergency=true');
      console.log('\n📌 ACTION: Create a new emergency request with urgency_level="critical"\n');
      return;
    }

    console.log(`📊 Found ${emergencyRequests.length} emergency requests:\n`);

    emergencyRequests.forEach((req, idx) => {
      console.log(`${'─'.repeat(80)}`);
      console.log(`REQUEST #${idx + 1}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`  ID: ${req._id}`);
      console.log(`  Blood Type: ${req.blood_type} (${req.units_requested} units)`);
      console.log(`  Urgency Level: ${req.urgency_level}`);
      console.log(`  is_emergency: ${req.is_emergency} (type: ${typeof req.is_emergency})`);
      console.log(`  Status: ${req.status}`);
      console.log(`  Created: ${req.created_at}`);
      console.log(`  Updated: ${req.updated_at}`);
      
      // Check forwarded_to
      if (req.forwarded_to && req.forwarded_to.length > 0) {
        console.log(`\n  🔄 Forwarded to ${req.forwarded_to.length} blood bank(s):`);
        req.forwarded_to.forEach((fwd, fidx) => {
          console.log(`     [${fidx + 1}] Bank ID: ${fwd.bloodbank_id}, Status: ${fwd.status}, At: ${fwd.forwarded_at}`);
        });
      }
      
      // Check SOS broadcast
      if (req.sos_broadcasted && req.sos_broadcasted.triggered) {
        console.log(`\n  📢 SOS Broadcast:`);
        console.log(`     Triggered: ✅ YES`);
        console.log(`     Donors Notified: ${req.sos_broadcasted.donors_notified || 0}`);
        console.log(`     Broadcasted At: ${req.sos_broadcasted.broadcasted_at}`);
      } else {
        console.log(`\n  📢 SOS Broadcast: ❌ NOT TRIGGERED`);
      }
      
      // Final verdict
      console.log(`\n  ${'═'.repeat(76)}`);
      const isCorrectStatus = req.status === 'auto_routing' || req.status === 'pending';
      const hasForwarding = req.forwarded_to && req.forwarded_to.length > 0;
      const hasSOSBroadcast = req.sos_broadcasted && req.sos_broadcasted.triggered;
      
      console.log(`  ✅ VERDICT:`);
      console.log(`     Status is 'auto_routing': ${req.status === 'auto_routing' ? '✅ YES' : '❌ NO (Status: ' + req.status + ')'}`);
      console.log(`     Has forwarded_to records: ${hasForwarding ? '✅ YES' : '❌ NO'}`);
      console.log(`     Has SOS broadcast: ${hasSOSBroadcast ? '✅ YES' : '❌ NO'}`);
      console.log(`  ${'═'.repeat(76)}\n`);
    });

    // Summary stats
    const autoRoutingCount = emergencyRequests.filter(r => r.status === 'auto_routing').length;
    const sosBroadcastCount = emergencyRequests.filter(r => r.sos_broadcasted?.triggered).length;
    const forwardedCount = emergencyRequests.filter(r => r.forwarded_to?.length > 0).length;

    console.log('═'.repeat(80));
    console.log('📋 SUMMARY');
    console.log('═'.repeat(80));
    console.log(`  Total Emergency Requests: ${emergencyRequests.length}`);
    console.log(`  In 'auto_routing' Status: ${autoRoutingCount}/${emergencyRequests.length}`);
    console.log(`  With SOS Broadcast: ${sosBroadcastCount}/${emergencyRequests.length}`);
    console.log(`  With Forwarding: ${forwardedCount}/${emergencyRequests.length}`);
    
    if (autoRoutingCount === emergencyRequests.length) {
      console.log(`\n  ✅ AUTO-ROUTING IS WORKING CORRECTLY!`);
    } else if (autoRoutingCount > 0) {
      console.log(`\n  ⚠️  PARTIAL: Some requests are in auto_routing, but not all`);
    } else {
      console.log(`\n  ❌ AUTO-ROUTING IS NOT WORKING`);
      console.log(`     All ${emergencyRequests.length} emergency requests should have status='auto_routing', but none do!`);
    }
    
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await mongoose.connection.close();
  }
}

verifyAutoRouting();
