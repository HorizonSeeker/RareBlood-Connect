/**
 * 🔍 DEBUG SCRIPT: Auto-Routing is_emergency Field Checker
 * 
 * Purpose: Fetch requests from DB and verify is_emergency field
 * Run: node DEBUG_AUTO_ROUTING.js
 */

import connectDB from './db/connectDB.mjs';
import HospitalRequest from './models/HospitalRequest.js';
import mongoose from 'mongoose';

async function debugAutoRouting() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 AUTO-ROUTING DEBUG - Database Field Inspector');
    console.log('='.repeat(80) + '\n');

    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Fetch all hospital requests
    const requests = await HospitalRequest.find({}).limit(10).sort({ created_at: -1 });

    if (requests.length === 0) {
      console.log('❌ No hospital requests found in database');
      return;
    }

    console.log(`📊 Found ${requests.length} requests. Analyzing:\n`);

    requests.forEach((request, index) => {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`REQUEST #${index + 1}: ${request._id}`);
      console.log(`${'─'.repeat(80)}`);
      
      console.log(`  Hospital: ${request.hospital_id}`);
      console.log(`  Blood Bank: ${request.bloodbank_id}`);
      console.log(`  Blood Type: ${request.blood_type} (${request.units_requested} units)`);
      console.log(`  Urgency Level: ${request.urgency_level}`);
      console.log(`  Status: ${request.status}`);
      console.log(`  Created: ${request.created_at}`);
      
      console.log('\n  🚨 IS_EMERGENCY FIELD ANALYSIS:');
      console.log(`     Raw Value: ${request.is_emergency}`);
      console.log(`     Data Type: ${typeof request.is_emergency}`);
      console.log(`     Is Truthy: ${!!request.is_emergency}`);
      console.log(`     === true: ${request.is_emergency === true}`);
      console.log(`     === 'true': ${request.is_emergency === 'true'}`);
      console.log(`     String(val) === 'true': ${String(request.is_emergency) === 'true'}`);
      console.log(`     Boolean(val): ${Boolean(request.is_emergency)}`);
      
      // Check if emergency check would trigger
      const wouldTriggerEmergency = String(request.is_emergency) === 'true' || request.is_emergency === true;
      console.log(`     ✅ Would Trigger Auto-Routing: ${wouldTriggerEmergency}`);
      
      // Show forwarded_to if present
      if (request.forwarded_to && request.forwarded_to.length > 0) {
        console.log(`\n  🔄 FORWARDED TO (${request.forwarded_to.length}):`);
        request.forwarded_to.forEach((fwd, idx) => {
          console.log(`     [${idx + 1}] Bank: ${fwd.bloodbank_id}, Status: ${fwd.status}, At: ${fwd.forwarded_at}`);
        });
      }
      
      // Show SOS broadcast if present
      if (request.sos_broadcasted && request.sos_broadcasted.triggered) {
        console.log(`\n  📢 SOS BROADCAST:`);
        console.log(`     Triggered: ${request.sos_broadcasted.triggered}`);
        console.log(`     Donors Notified: ${request.sos_broadcasted.donors_notified || 0}`);
        console.log(`     At: ${request.sos_broadcasted.broadcasted_at}`);
      }
    });

    console.log(`\n${'═'.repeat(80)}`);
    console.log('📋 SUMMARY:');
    console.log(`${'═'.repeat(80)}`);
    
    const emergencyRequests = requests.filter(r => r.is_emergency === true || String(r.is_emergency) === 'true');
    const autoRoutingRequests = requests.filter(r => r.status === 'auto_routing');
    const rejectedRequests = requests.filter(r => r.status === 'rejected');
    
    console.log(`  Total Requests: ${requests.length}`);
    console.log(`  Emergency Requests (is_emergency=true/string): ${emergencyRequests.length}`);
    console.log(`  Auto-Routing Status: ${autoRoutingRequests.length}`);
    console.log(`  Rejected Status: ${rejectedRequests.length}`);
    console.log(`  Mismatch Alert: ${emergencyRequests.length !== autoRoutingRequests.length ? '⚠️ YES' : '✅ NO'}`);
    
    if (emergencyRequests.length > 0 && autoRoutingRequests.length === 0) {
      console.log('\n  ❌ ISSUE FOUND:');
      console.log('     Emergency requests exist but NONE are in auto_routing status!');
      console.log('     This means is_emergency is NOT triggering the auto-routing logic.');
    } else if (emergencyRequests.length > 0 && autoRoutingRequests.length > 0) {
      console.log('\n  ✅ Auto-routing appears to be working');
    }

    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
  }
}

// Run the debug
debugAutoRouting();
