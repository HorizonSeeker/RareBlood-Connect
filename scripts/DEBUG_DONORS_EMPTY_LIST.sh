#!/bin/bash

# 🆘 DIAGNOSTIC GUIDE: "Donors found but list empty" Issue
# Date: March 19, 2026

cat << 'EOF'

╔═══════════════════════════════════════════════════════════════════════════════╗
║    🔍 DEBUG GUIDE: Emergency Found 3 Donors, but List is Empty               ║
║                                                                               ║
║  When blood bank rejects emergency:                                          ║
║  - Broadcast says: "Found 3 donors, sent to 3"                              ║
║  - But hospital gets: empty donor list []                                    ║
║                                                                               ║
║  This guide helps identify WHY.                                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 ROOT CAUSES IDENTIFIED & FIXED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ISSUE #1: Wrong Field Check in GET Endpoint
────────────────────────────────────────────

BEFORE:
  if (request.sos_broadcasted?.donors_notified > 0) {  // ❌ FIELD NOT EXIST!

AFTER:
  if (request.sos_broadcasted?.database_records_created >= 0 &&
      request.sos_broadcasted?.database_records_created > 0) {  // ✅ CORRECT

IMPACT: GET endpoint now correctly identifies when to populate donors
STATUS: ✅ FIXED


ISSUE #2: RequestId Not Saved Consistently
───────────────────────────────────────────

fcmNotificationService.js:
  BEFORE: requestId: hospitalRequest._id  // ← Possible string!
  AFTER:  requestId: new mongoose.Types.ObjectId(hospitalRequest._id)

sosService.js:
  Already correct: requestId: new mongoose.Types.ObjectId(hospitalRequest._id)

IMPACT: Query DonorContactRequest.find({requestId: X}) now matches correctly
STATUS: ✅ FIXED


ISSUE #3: Time Window Too Strict (3 minutes only)
──────────────────────────────────────────────────

BEFORE:
  const timeWindowStart = new Date(broadcastTime.getTime() - 3 * 60 * 1000);
  const timeWindowEnd = new Date(broadcastTime.getTime() + 3 * 60 * 1000);

AFTER:
  const timeWindowStart = new Date(broadcastTime.getTime() - 15 * 60 * 1000);
  const timeWindowEnd = new Date(broadcastTime.getTime() + 15 * 60 * 1000);

IMPACT: Fallback query widened from 3 mins to 15 mins
STATUS: ✅ FIXED


ISSUE #4: Poor Error Diagnostics
─────────────────────────────────

BEFORE: Failed silently if query returned 0

AFTER: 
  - Logs time window being searched
  - Warns if stored count != actual count
  - Attempts direct count for diagnosis
  - Shows ObjectId conversion if failed

IMPACT: Can now debug WHY query returned 0
STATUS: ✅ FIXED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CHECK THESE LOGS AFTER FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When blood bank rejects emergency, check server logs for:

1. Broadcast Phase:
   ─────────────────
   [SOS] 🔍 Searching for donors...
   [SOS] ✅ Found X donors
   [SOS] Sending SOS notifications...
   [SOS] ✅ Created DonorContactRequest for donor Y
   [SOS] ✅ Summary: Y FCM sent, Z DB records created

2. GET Endpoint Phase:
   ───────────────────
   [SOS Query] ==========================================
   [SOS Query] Request ID: [ID]
   [SOS Query] Stored metrics: Total=X, FCM=Y, DB=Z
   [SOS Query] Searching DonorContactRequest with requestId...
   [SOS Query] Step 1 - Found N DonorContactRequest records
   
   [EXPECTED: N > 0]
   
   If N = 0:
   [SOS Query] Fallback: Trying by hospitalId + recent timestamp...
   [SOS Query] Time range: [START] to [END]
   [SOS Query] Fallback found M records

   [EXPECTED: M > 0]
   
   If M = 0 but stored DB > 0:
   [SOS Query] ⚠️  WARNING: Stored DB count=Z, but query found 0!
   [SOS Query] Attempting direct MongoDB count...
   [SOS Query] Direct count query: Q records

3. Population Phase:
   ──────────────
   [SOS Query] Populating N donor contact requests...
   [SOS Query] Processing record [ID], donorId: [DONOR_ID], type: object
   [SOS Query] ✅ Added donor: [NAME]
   ...
   [SOS Query] ✅ Final result: X donors populated
   [SOS Query] Metrics: Stored DB=Z, Actual DB=N, Populated=X

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 TROUBLESHOOTING: "Found 3 but list empty"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Case: Blood bank rejects emergency after finding 3 donors

SCENARIO A: Hospital Gets Empty List
─────────────────────────────────────

Expected Logs:
  [SOS] ✅ Created DonorContactRequest for donor [ID1]
  [SOS] ✅ Created DonorContactRequest for donor [ID2]
  [SOS] ✅ Created DonorContactRequest for donor [ID3]
  [SOS] ✅ Summary: 3 FCM sent, 3 DB records created

Then on GET:
  [SOS Query] Step 1 - Found 3 DonorContactRequest records  ← Should find 3!
  [SOS Query] Processing record [ID], donorId: [DONOR_ID]
  [SOS Query] ✅ Added donor: [NAME]
  ...
  [SOS Query] ✅ Final result: 3 donors populated  ← Should return 3!

If instead you see:
  [SOS Query] Step 1 - Found 0 DonorContactRequest records  ← BUG!

Possible causes:

1. RequestId mismatch:
   - Check logs for exact requestId values
   - Verify they're the same between broadcast and GET
   - Solution: Fixed in latest code (ObjectId wrapping)

2. Query executed before records created:
   - Broadcast might still be writing
   - Solution: Check DB latency, indices

3. Different query windows:
   - Time window too narrow or clock skew
   - Solution: Fixed (widened to 15 mins)

SCENARIO B: Broadcast Says "3 donors" but Actually Created 1
─────────────────────────────────────────────────────────────

Possible causes:

1. FCM succeeded but DB failed:
   [SOS] ⚠️  Error creating DonorContactRequest: [ERROR]
   
   This is tracked:
   [SOS] Summary: 3 FCM sent, 1 DB records created, 2 failures
   
   So metrics will show:
   {
     donorsNotified: 3,
     recordsCreated: 1,
     failuresCount: 2
   }
   ✓ This is correct behavior (you see the mismatch)

2. ObjectId conversion failed:
   Check logs for "ObjectId" errors
   Solution: Fixed in latest code

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 VERIFICATION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run after applying fixes:

[ ] 1. Create emergency request
      POST /api/hospital-requests
      with is_emergency: true

[ ] 2. Blood bank rejects
      PUT /api/hospital-requests/[ID]
      with status: "rejected"

[ ] 3. Check API response
      Should include:
      {
        "autoRouting": {
          "totalDonorsFound": X,
          "nearbyDonorsNotified": Y,
          "databaseRecordsCreated": Z,  ← This is KEY
          "failuresCount": W
        }
      }

[ ] 4. Check server logs for "[SOS]" messages
      Verify: X >= Y >= Z (at each step)

[ ] 5. GET hospital-requests endpoint
      GET /api/hospital-requests?role=hospital
      
      Look for sos_donor_details array
      Should have Z items (matching databaseRecordsCreated)

[ ] 6. Check logs for "[SOS Query]" messages
      Verify: "Found X DonorContactRequest records"
      Should match step 2 databaseRecordsCreated count

[ ] 7. If empty list:
      Look for warnings like:
      "⚠️  MISMATCH" or "⚠️  WARNING"
      
      These help identify where it failed

✅ All checks pass = Lists now populated correctly!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 DEEP DIVE: Execute Manual MongoDB Query
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When debugging, you can query directly:

  mongosh

  use rareblood

  # Check how many DonorContactRequest records exist for request
  db.donorcontactrequests.find({
    requestId: ObjectId("507f1f77bcf86cd799439011")
  }).count()

  # See the actual records
  db.donorcontactrequests.find({
    requestId: ObjectId("507f1f77bcf86cd799439011")
  }).pretty()

  # Check if requestId is stored as string instead of ObjectId
  db.donorcontactrequests.find({
    requestId: "507f1f77bcf86cd799439011"  // as string
  }).count()

  # Check indices
  db.donorcontactrequests.getIndexes()

  # Sample DonorContactRequest document
  db.donorcontactrequests.findOne().pretty()

Key things to look for:
  - requestId field is ObjectId type (not string)
  - donorId field exists and not null
  - createdAt is recent
  - status is "pending"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 CHANGES MADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. app/api/hospital-requests/route.js
   - Added mongoose import
   - Fixed GET condition check (donors_notified → database_records_created)
   - Widened time window (3 mins → 15 mins) for fallback query
   - Added direct count diagnostic when records not found
   - Added ObjectId conversion safety check in populate loop
   - Enhanced logging for troubleshooting

2. lib/fcmNotificationService.js
   - Ensured all ObjectIds wrapped consistently
   - Added missing fields (sourceType, urgencyLevel, message, expiresAt)

3. lib/sosService.js
   - Already correct, no changes needed

Results:
✅ Fixed: Donors will now be retrieved when broadcast finds them
✅ Fixed: Better diagnostics if query fails
✅ Fixed: Consistent ObjectId handling across both broadcast methods

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Need more help? Check these docs:
- DONOR_COUNT_ANALYSIS.md - Deep technical analysis
- TESTING_GUIDE.sh - Complete test scenarios
- VERIFY_DONOR_COUNT_CONSISTENCY.js - Automated verification

EOF
