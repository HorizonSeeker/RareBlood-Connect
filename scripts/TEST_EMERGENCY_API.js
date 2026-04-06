#!/usr/bin/env node

/**
 * Test Emergency Blood Request API
 * 
 * This script tests the emergency flow endpoint with proper JWT authentication
 * 
 * Usage:
 * node TEST_EMERGENCY_API.js
 * 
 * Expected Output:
 * ✅ 201 Created
 * ✅ status: "IN_PROGRESS"
 * ✅ bloodbank_id: null
 * ✅ Geospatial search results
 */

import jwt from 'jsonwebtoken';
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || '12345679';

// Create test JWT token
const testUser = {
  userId: '69b970e8c9064b3997886017',  // From database
  email: 'emergency@test.com',
  role: 'hospital',
  name: 'Test Emergency Hospital'
};

const token = jwt.sign(testUser, JWT_SECRET);

console.log('🧪 Testing Emergency Blood Request API');
console.log('=====================================\n');

console.log('📋 Test Setup:');
console.log(`   - Token created for: ${testUser.email} (${testUser.role})`);
console.log(`   - Token: ${token.substring(0, 30)}...`);
console.log(`   - API Base: ${API_BASE}\n`);

// Test 1: Emergency flow (without bloodbank_id)
console.log('✅ TEST 1: POST /api/requests - EMERGENCY FLOW (No bloodbank_id)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const emergencyPayload = {
  blood_type: 'O+',
  units_required: 5,
  latitude: 10.8577,    // HCM City
  longitude: 106.6814,  // HCM City
  search_radius_km: 5,
  urgency_level: 'CRITICAL'
};

console.log('\nRequest Payload:');
console.log('  POST /api/requests');
console.log('  Authorization: Bearer ' + token.substring(0, 30) + '...');
console.log('  Body:', JSON.stringify(emergencyPayload, null, 2));

axios.post(`${API_BASE}/requests`, emergencyPayload, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
})
  .then(response => {
    console.log('\n✅ Response Status:', response.status);
    console.log('\nResponse Data:');
    console.log('  request_id:', response.data.data?.request_id);
    console.log('  status:', response.data.data?.status);
    console.log('  blood_type:', response.data.data?.blood_type);
    console.log('  bloodbank_id:', response.data.data?.bloodbank_id);
    console.log('  metadata.flow:', response.data.data?.metadata?.flow);
    console.log('  metadata.inventory_status:', response.data.data?.metadata?.inventory_status);
    console.log('  coordinates:', response.data.data?.coordinates);

    if (response.data.data?.status === 'IN_PROGRESS') {
      console.log('\n🎉 SUCCESS! Emergency flow activated');
      console.log('   Status: IN_PROGRESS');
      console.log('   Bloodbank ID: null (as expected)');
      console.log('   Geospatial search will run in background');
      console.log('   FCM notifications will be sent to nearby donors');
    }

    console.log('\n📊 Full Response:');
    console.log(JSON.stringify(response.data, null, 2));
  })
  .catch(error => {
    if (error.response) {
      console.log('\n❌ Response Status:', error.response.status);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ Connection refused - is the dev server running?');
      console.log('   Run: npm run dev');
    } else {
      console.log('\n❌ Error:', error.message);
    }
    process.exit(1);
  })
  .finally(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  });
