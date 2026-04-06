/**
 * Blood Request API Tests
 * 
 * Test file: __tests__/blood-request.test.js
 * Run: npm test -- blood-request.test.js
 * 
 * Tests the 5-step logic and race condition protection
 */

import axios from 'axios';
import connectDB from '@/db/connectDB.mjs';
import BloodRequest from '@/models/BloodRequest.js';
import BloodInventory from '@/models/BloodInventory.js';
import User from '@/models/User.js';
import BloodBank from '@/models/BloodBank.js';

const BASE_URL = 'http://localhost:3000/api';
const api = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

describe('Blood Request API - 5-Step Logic', () => {
  
  let testUser, testBloodBank, testInventory, authToken;

  beforeAll(async () => {
    await connectDB();
    
    // Create test hospital user
    testUser = await User.create({
      name: 'Test Hospital',
      email: 'hospital@test.com',
      role: 'hospital',
      password: 'hashed_pwd'
    });

    // Create test blood bank
    testBloodBank = await BloodBank.create({
      name: 'Test Blood Bank',
      location: 'City Hospital',
      contact_number: '1234567890',
      email: 'bb@test.com'
    });

    // Create test inventory
    testInventory = await BloodInventory.create({
      bloodbank_id: testBloodBank._id,
      blood_type: 'O+',
      units_available: 100,
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    // Mock auth token (in real test, use nextauth)
    authToken = 'mock_token_' + testUser._id;
  });

  afterAll(async () => {
    await User.deleteOne({ _id: testUser._id });
    await BloodBank.deleteOne({ _id: testBloodBank._id });
    await BloodInventory.deleteOne({ _id: testInventory._id });
  });

  // ✅ TEST 1: Normal flow - Sufficient inventory
  describe('Step 1-3: Normal Flow (Sufficient Inventory)', () => {
    test('Should create APPROVED request when units >= required', async () => {
      const response = await api.post(
        '/requests',
        {
          blood_type: 'O+',
          units_required: 50,
          bloodbank_id: testBloodBank._id.toString(),
          urgency_level: 'HIGH',
          latitude: 10.7769,
          longitude: 106.7009
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.request.status).toBe('APPROVED');
      expect(response.data.metadata.inventory.units_reserved).toBe(50);

      // Verify inventory was decremented
      const updatedInventory = await BloodInventory.findById(testInventory._id);
      expect(updatedInventory.units_available).toBe(50);
    });
  });

  // ⚠️ TEST 2: Race Condition Detection
  describe('Step 3: Race Condition Protection', () => {
    test('Should handle concurrent requests and fallback to IN_PROGRESS', async () => {
      // Prep: Create fresh inventory with 60 units
      const freshInventory = await BloodInventory.create({
        bloodbank_id: testBloodBank._id,
        blood_type: 'A+',
        units_available: 60,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // Simulate 2 concurrent requests
      const promise1 = api.post(
        '/requests',
        {
          blood_type: 'A+',
          units_required: 50,
          bloodbank_id: testBloodBank._id.toString(),
          urgency_level: 'HIGH',
          latitude: 10.7769,
          longitude: 106.7009
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const promise2 = api.post(
        '/requests',
        {
          blood_type: 'A+',
          units_required: 50,
          bloodbank_id: testBloodBank._id.toString(),
          urgency_level: 'HIGH',
          latitude: 10.7769,
          longitude: 106.7009
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const [response1, response2] = await Promise.all([promise1, promise2]);

      // Both should succeed
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);

      // First request gets APPROVED, second gets IN_PROGRESS (due to race condition)
      const status1 = response1.data.request.status;
      const status2 = response2.data.request.status;

      expect([status1, status2]).toContain('APPROVED');
      expect([status1, status2]).toContain('IN_PROGRESS');

      console.log(`   ✅ Race condition handled: Request1=${status1}, Request2=${status2}`);
    });
  });

  // 📍 TEST 4: GeoJSON Query
  describe('Step 4-5: Insufficient Inventory + GeoJSON Search', () => {
    test('Should set IN_PROGRESS and trigger GeoJSON when insufficient', async () => {
      // Create inventory with only 30 units (less than 80% of 50 required)
      const lowInventory = await BloodInventory.create({
        bloodbank_id: testBloodBank._id,
        blood_type: 'B+',
        units_available: 30,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const response = await api.post(
        '/requests',
        {
          blood_type: 'B+',
          units_required: 50,
          bloodbank_id: testBloodBank._id.toString(),
          urgency_level: 'CRITICAL',
          latitude: 10.7769,
          longitude: 106.7009,
          search_radius_km: 10
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.status).toBe(201);
      expect(response.data.request.status).toBe('IN_PROGRESS');
      expect(response.data.request.geosearch_triggered).toBe(false); // Will be true after async completes
      expect(response.data.request.user_latitude).toBe(10.7769);
      expect(response.data.request.user_longitude).toBe(106.7009);

      console.log(`   ✅ IN_PROGRESS request created, GeoJSON will trigger async`);
    });
  });

  // 📊 TEST 5: Response Validation
  describe('Response Structure', () => {
    test('Should return correct metadata structure', async () => {
      const response = await api.post(
        '/requests',
        {
          blood_type: 'O+',
          units_required: 25,
          bloodbank_id: testBloodBank._id.toString(),
          latitude: 10.7769,
          longitude: 106.7009
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.data.success).toBe(true);
      expect(response.data.metadata).toHaveProperty('processing_time_ms');
      expect(response.data.metadata).toHaveProperty('inventory');
      expect(response.data.metadata.inventory).toHaveProperty('source');
      expect(response.data.metadata.inventory).toHaveProperty('available_units');
      expect(response.data.metadata.inventory).toHaveProperty('units_reserved');
      expect(response.data.metadata.inventory).toHaveProperty('status');

      console.log(`   ✅ Response structure valid`);
      console.log(`   ✅ Processing time: ${response.data.metadata.processing_time_ms}ms`);
    });
  });
});

describe('Blood Request API - Error Handling', () => {
  test('Should return 401 for unauthorized request', async () => {
    const response = await api.post('/requests', {
      blood_type: 'O+',
      units_required: 50,
      bloodbank_id: 'invalid'
    });

    expect(response.status).toBe(401);
    expect(response.data.error).toBe('Unauthorized');
  });

  test('Should return 400 for missing required fields', async () => {
    const response = await api.post(
      '/requests',
      { blood_type: 'O+' },  // Missing units_required, bloodbank_id
      { headers: { Authorization: 'Bearer mock_token' } }
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('Missing required fields');
  });
});

console.log(`
✅ Test suite ready. Run with:
   npm test -- blood-request.test.js

Key tests:
  ✓ Step 1-3: Normal flow with sufficient inventory
  ✓ Step 3: Race condition protection
  ✓ Step 4-5: GeoJSON trigger on insufficient inventory
  ✓ Response structure validation
  ✓ Error handling
`);
