#!/bin/bash

# 🧪 TESTING GUIDE: Verify Donor Count Fix
# Run these tests to ensure the fix is working correctly
# Date: March 19, 2026

cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════════════════╗
║        🧪 DONOR COUNT FIX VERIFICATION & TESTING GUIDE                        ║
║                                                                               ║
║  This guide will help you test and verify that the donor count fix           ║
║  is working correctly in your environment.                                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PREREQUISITE SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before running tests, ensure:

✓ MongoDB is running and accessible
  → Check: mongosh command works
  → Run: use rareblood

✓ Server is running
  → npm run dev (or yarn dev)
  → Check: http://localhost:3000

✓ Test data exists:
  → Hospital account created
  → Blood bank account created
  → At least 50 donors with:
    - valid location data
    - set to is_active: true
    - blood_type field populated
    - currentLocation with GeoJSON { type: Point, coordinates: [...] }

✓ MongoDB 2dsphere index on Doner
  → db.doners.createIndex({ "current_location": "2dsphere" })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 TEST SCENARIO 1: BASIC EMERGENCY FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objective: Test that emergency rejection triggers broadcast and tracks all metrics

Steps:

1. CREATE EMERGENCY REQUEST
   ──────────────────────────

   POST /api/hospital-requests
   Content-Type: application/json
   Authorization: Bearer [HOSPITAL_TOKEN]

   {
     "bloodbank_id": "[BLOOD_BANK_ID]",
     "request_type": "patient",
     "blood_type": "O+",
     "units_requested": 2,
     "urgency_level": "critical",
     "is_emergency": true,
     "user_latitude": 10.7769,
     "user_longitude": 106.6869,
     "patient_details": {
       "name": "Test Patient",
       "age": 45,
       "condition": "Surgery"
     },
     "reason": "Emergency surgery"
   }

   ✓ Expected: 201 with request ID

   Example response:
   {
     "success": true,
     "request": {
       "_id": "507f1f77bcf86cd799439011",
       "status": "pending",
       "is_emergency": true,
       ...
     }
   }

   Save REQUEST_ID from response

2. BLOOD BANK REJECTS REQUEST
   ────────────────────────────

   PUT /api/hospital-requests/[REQUEST_ID]
   Content-Type: application/json
   Authorization: Bearer [BLOOD_BANK_TOKEN]

   {
     "status": "rejected",
     "response_message": "Out of stock today"
   }

   ✓ Expected: 200 with autoRouting data

   Important: Check response includes:
   {
     "success": true,
     "autoRouting": {
       "totalDonorsFound": INTEGER,
       "nearbyDonorsNotified": INTEGER,
       "databaseRecordsCreated": INTEGER,
       "failuresCount": INTEGER,
       "bloodBankForwarded": STRING or null
     }
   }

   ✓ Verify: All 5 fields present
   ✓ Verify: nearbyDonorsNotified <= totalDonorsFound
   ✓ Verify: databaseRecordsCreated <= nearbyDonorsNotified

3. CHECK SERVER LOGS
   ──────────────────

   Look for these log patterns:

   [SOS] 🔍 Searching for donors near blood bank: ...
   [SOS] ✅ Found X donors near blood bank
   [SOS] Sending SOS notifications
   [SOS] ✅ Summary: Y FCM sent, Z DB records created
   [SOS] Broadcast Result - Found: X, FCM: Y, DB: Z

   ✓ Verify numbers match API response

4. GET REQUEST DETAILS
   ────────────────────

   GET /api/hospital-requests?role=hospital&status=auto_routing
   Authorization: Bearer [HOSPITAL_TOKEN]

   Look for request in response:
   {
     "requests": [
       {
         "_id": "[REQUEST_ID]",
         "sos_broadcasted": {
           "triggered": true,
           "total_donors_found": X,
           "donors_fcm_sent": Y,
           "database_records_created": Z,
           "failures_count": W
         },
         "sos_donor_metrics": {
           "stored_db_records": Z,
           "actual_db_records": Z,
           "mismatch_detected": false
         },
         "sos_donor_details": [...]
       }
     ]
   }

   ✓ Verify: All metrics fields present
   ✓ Verify: actual_db_records matches stored_db_records
   ✓ Verify: mismatch_detected = false (not true)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 TEST SCENARIO 2: VERIFICATION SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objective: Run automated verification after completing Scenario 1

Steps:

1. RUN FULL VERIFICATION
   ──────────────────────

   node VERIFY_DONOR_COUNT_CONSISTENCY.js

   Expected output:
   ```
   📊 DONOR COUNT CONSISTENCY VERIFICATION
   ════════════════════════════════════════════
   ✅ Connected to MongoDB

   📋 Found X emergency requests with SOS broadcasts

   🔍 Checking Request [ID]...
   ════════════════════════════════════════════
   📊 STORED METRICS:
      Total Donors Found:    45
      FCM Notifications:     43
      DB Records Created:    42
      Failures:              3

   💾 ACTUAL DATABASE COUNT:
      DonorContactRequest:   42
      - With FCM sent:       43
      - Without FCM:         0

   ✓ VERIFICATION RESULTS:
     ✅ DB Records = Stored Records
     ✅ FCM Sent = Records with broadcast_notification_sent
     ✅ FCM Sent <= Total Records

   ════════════════════════════════════════════
   📈 VERIFICATION SUMMARY
   ════════════════════════════════════════════
   Requests Checked:      1
   Issues Found:          0

   ✅ ALL CHECKS PASSED! Donor counts are consistent.
   ```

   ✓ Expected: 0 issues found
   ✓ Expected: ALL CHECKS PASSED message
   ✓ Expected: Exit code 0 (success)

2. CHECK SPECIFIC REQUEST (Optional)
   ──────────────────────────────────

   node VERIFY_DONOR_COUNT_CONSISTENCY.js --request-id 507f1f77bcf86cd799439011

   Look for:
   - Stored vs Actual metrics comparison
   - Detailed donor list
   - Discrepancy analysis
   - All 3 verification checks passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ TEST SCENARIO 3: ERROR CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objective: Verify system handles errors gracefully

Scenario A: No nearby donors found
──────────────────────────────────

1. Create request with location with no donors nearby
2. Blood bank rejects
3. Expected response:
   {
     "autoRouting": {
       "totalDonorsFound": 0,
       "nearbyDonorsNotified": 0,
       "databaseRecordsCreated": 0,
       "failuresCount": 0
     }
   }

✓ Should NOT crash
✓ Request status should be 'auto_routing'
✓ No database errors in logs

Scenario B: MongoDB down (simulate)
────────────────────────────────────

1. Stop MongoDB
2. Try to create/reject request
3. Expected: 500 error with descriptive message
4. Start MongoDB again
5. Verify logs show recovery

✓ Should handle gracefully
✓ Detailed error message

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 EXPECTED METRICS RANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When running tests, expect these ranges:

totalDonorsFound:
  - Depends on your test data
  - Usually 20-100 for typical search radius
  - 0 if no donors in area

nearbyDonorsNotified:
  - Usually 80-95% of totalDonorsFound
  - Missing donors lack FCM token
  - FCM send failures

databaseRecordsCreated:
  - Usually 95-99% of nearbyDonorsNotified
  - Some DB writes might fail (network, timeout)
  - Should be close to nearbyDonorsNotified

failuresCount:
  - Usually 1-10 for 50+ donors
  - 0 is ideal but rare at scale
  - >20% indicates issues

🎯 Rule: totalDonorsFound >= nearbyDonorsNotified >= databaseRecordsCreated

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 MONITORING AFTER FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Daily checks:

1. Run verification script
   node VERIFY_DONOR_COUNT_CONSISTENCY.js

2. Check logs for patterns:
   grep "MISMATCH ALERT" logs/
   → Should be empty or rare
   → If frequent: investigate DB issues

3. Monitor these KPIs:
   - Success rate: (databaseRecordsCreated / totalDonorsFound) * 100
   - Mismatch rate: (requests with mismatches / total requests) * 100
   - Average donors per broadcast

4. Alert thresholds:
   ⚠️ If mismatch_detected = true more than once per day
   ⚠️ If success rate drops below 80%
   ⚠️ If failuresCount > 20% of donors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SIGN-OFF CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before marking fix as "deployed":

[ ] Scenario 1 - Basic Emergency Flow: PASSED
    [ ] Request created successfully
    [ ] Auto-routing triggered on rejection
    [ ] Response has all 5 metrics
    [ ] GET endpoint shows metrics
    [ ] Logs show broadcast details

[ ] Scenario 2 - Verification Script: PASSED
    [ ] Script runs without errors
    [ ] "ALL CHECKS PASSED" message
    [ ] No mismatches detected
    [ ] Exit code 0

[ ] Scenario 3 - Error Conditions: HANDLED
    [ ] No nearby donors: handled gracefully
    [ ] DB down: error caught, recovered
    [ ] Network issues: logged

[ ] Code Quality
    [ ] No console errors
    [ ] No unhandled rejections
    [ ] All imports working
    [ ] Database operations stable

[ ] Documentation
    [ ] Read DONOR_COUNT_FIX_SUMMARY.md
    [ ] Understand new metrics fields
    [ ] Know how to run verification
    [ ] Know what to do if mismatch

[ ] Team Communication
    [ ] Informed team about changes
    [ ] Provided documentation
    [ ] Scheduled monitoring
    [ ] Created runbooks for issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 SUPPORT / TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: mismatch_detected = true

  Investigation:
  1. Run: node VERIFY_DONOR_COUNT_CONSISTENCY.js --request-id [ID]
  2. Check output for "DISCREPANCY ANALYSIS"
  3. Check server logs for "[SOS]" errors
  4. Check MongoDB connection

  Common causes:
  - Network timeout during DB write
  - MongoDB replication lag
  - Concurrent updates
  - Storage quota exceeded

Issue: failuresCount is high (>50%)

  Investigation:
  1. Check MongoDB logs
  2. Check FCM service (Firebase) status
  3. Check donor FCM token validity
  4. Check network connectivity

Issue: Verification script errors

  Solutions:
  1. Ensure MongoDB running: mongosh
  2. Ensure MONGODB_URI in .env.local
  3. Check file permissions: ls -la VERIFY_*.js
  4. Check Node version: node --version (should be 16+)
  5. Reinstall deps: npm install

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Need help? Check:
- DONOR_COUNT_ANALYSIS.md - Technical deep dive
- DONOR_COUNT_FIX_SUMMARY.md - Implementation details
- DONOR_COUNT_QUICK_REFERENCE.sh - Quick reference

EOF
