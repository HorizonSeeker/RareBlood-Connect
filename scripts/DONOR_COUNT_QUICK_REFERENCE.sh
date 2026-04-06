#!/bin/bash

# 🔍 QUICK REFERENCE: Donor Count Consistency Updates
# 
# Use this guide to understand and test the donor count fix
# Last Updated: March 19, 2026

echo "📊 DONOR COUNT CONSISTENCY - QUICK REFERENCE"
echo "==========================================="
echo ""

# ===========================================================================
# SECTION 1: UNDERSTANDING THE CHANGES
# ===========================================================================

cat << 'EOF'
## 🎯 WHAT WAS FIXED?

Problem: When a blood bank rejects an emergency request, the number of donors 
         shown when rejected ≠ the number of donors in the database

Solution: Now tracking ALL metrics separately:
  ✅ totalDonorsFound   - Donors located by geosearch
  ✅ donorsNotified (FCM) - Successful FCM notifications sent
  ✅ recordsCreated (DB) - DonorContactRequest records created
  ✅ failuresCount       - Combined failures from FCM + DB operations

---

## 📁 FILES CHANGED

1. lib/fcmNotificationService.js
   - Changed return value from number → object with 5 metrics
   - Added failuresCount tracking

2. lib/sosService.js
   - Added totalDonorsFound to return object
   - Added failuresCount tracking
   - Consistent format with fcmNotificationService.js

3. app/api/hospital-requests/route.js
   - Updated to unpack all 5 metrics from broadcast result
   - Store all metrics in sos_broadcasted object
   - GET endpoint now queries actual DB records
   - Added mismatch detection and logging
   - Return all metrics in API response

4. NEW: VERIFY_DONOR_COUNT_CONSISTENCY.js
   - Verification script to check integrity
   - Can check all broadcasts or specific request

---

## 🧪 TESTING STEPS

### Quick Test (Manual):

1. Create emergency request
   POST /api/hospital-requests
   {
     "is_emergency": true,
     "blood_type": "O+",
     "units_requested": 2,
     ...
   }

2. Have blood bank reject it
   PUT /api/hospital-requests/:id
   {
     "status": "rejected",
     "response_message": "Out of stock"
   }

3. Check auto-routing response
   Response should include:
   {
     "autoRouting": {
       "totalDonorsFound": 45,
       "nearbyDonorsNotified": 43,
       "databaseRecordsCreated": 42,
       "failuresCount": 3,
       "bloodBankForwarded": "Bank Name"
     }
   }

4. Verify with GET endpoint
   GET /api/hospital-requests?role=hospital&status=all
   
   For SOS requests, response includes:
   {
     "sos_broadcasted": {
       "total_donors_found": 45,
       "donors_fcm_sent": 43,
       "database_records_created": 42,
       "failures_count": 3
     },
     "sos_donor_metrics": {
       "stored_db_records": 42,
       "actual_db_records": 42,
       "mismatch_detected": false  ← Should be false
     }
   }

### Automated Test (Script):

Run verification script:
  node VERIFY_DONOR_COUNT_CONSISTENCY.js

Should output:
  ✅ ALL CHECKS PASSED! Donor counts are consistent.

If issues found:
  ⚠️ X critical issue(s) detected!
  [Shows detailed mismatches]

---

## 💡 UNDERSTANDING THE METRICS

When blood bank rejects emergency request:

┌─────────────────────────────────────────────────────┐
│ BROADCAST PHASE                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Find Nearby Donors                                │
│  └─ totalDonorsFound = 45 (geosearch result)       │
│                                                     │
│  Send FCM to Each Donor (45 donors)                │
│  ├─ Success: 43 (donorsNotified)                   │
│  ├─ Failed: 2                                       │
│  └─ donorsNotified always ≤ totalDonorsFound       │
│                                                     │
│  Create DB Records for FCM Successes (43)          │
│  ├─ Success: 42 (recordsCreated)                   │
│  ├─ Failed: 1                                       │
│  └─ recordsCreated always ≤ donorsNotified         │
│                                                     │
│  failuresCount = All failures = 3                  │
│  (2 FCM fails + 1 DB fail + 0 other)               │
│                                                     │
└─────────────────────────────────────────────────────┘

Key Rule: totalDonorsFound ≥ donorsNotified ≥ recordsCreated

---

## 🚨 WHAT IF MISMATCH IS DETECTED?

If mismatch_detected = true:

  Possible causes (in order of likelihood):
  1. DB write failure (DB connection issue)
  2. Concurrent updates (race condition)
  3. Query filtering (query returned subset)
  4. Logic error (should not happen)

  What to do:
  1. Check server logs for DB errors
  2. Run verification script again
  3. Check network connectivity
  4. If persistent: contact admin

---

## 📊 MONITORING CHECKLIST

Use this checklist to verify the fix is working:

For EACH emergency rejection:

[ ] Response includes autoRouting object
[ ] autoRouting has all 5 fields (no missing fields)
[ ] totalDonorsFound >= nearbyDonorsNotified (makes sense)
[ ] nearbyDonorsNotified >= databaseRecordsCreated (makes sense)
[ ] Logs show broadcast metrics (check server logs)
[ ] GET endpoint returns sos_donor_metrics
[ ] mismatch_detected = false (in normal conditions)
[ ] failuresCount = 0 or small number (not huge)

If any check fails:
  → Investigation needed
  → Run verification script
  → Contact development team

---

## 🔧 DEBUGGING TIPS

Check specific request:

  node VERIFY_DONOR_COUNT_CONSISTENCY.js \\
    --request-id 507f1f77bcf86cd799439011

Look for in server logs:

  "[SOS]" prefix logs = broadcast phase
  "[SOS Query]" prefix logs = GET retrieval phase
  "MISMATCH ALERT" = inconsistency detected
  "Metrics:" = detailed breakdown

---

## 📈 METRICS TO TRACK OVER TIME

Create a dashboard monitoring:

  Average totalDonorsFound per broadcast
  Average donorsNotified per broadcast
  Average recordsCreated per broadcast
  Success rate (recordsCreated / totalDonorsFound)
  Failure rate (failuresCount / totalDonorsFound)
  Mismatch frequency (% of requests with mismatch)

Current benchmarks (after fix):
  - Success rate: Should be 85-95%
  - Failure rate: Should be <5%
  - Mismatch frequency: Should be <1%

If metrics degrade:
  investigates potential issues

---

## ❓ FAQ

Q: Why is donorsNotified < recordsCreated sometimes?
A: It shouldn't be! That's a bug. Run verification script immediately.

Q: Is it normal for totalDonorsFound >> recordsCreated?
A: Yes, if many donors don't have FCM tokens or if there are failures.
   Check logs to see breakdown.

Q: Should failuresCount always be 0?
A: No. Some failures are expected (bad networks, timeout, etc).
   Concern if failuresCount > 10% of totalDonorsFound.

Q: What's the difference between donorsNotified and recordsCreated?
A: donorsNotified = FCM notifications sent
   recordsCreated = DB records created after FCM success
   A donor might get FCM but DB write fails (network issue, etc)

Q: Should I worry about mismatch_detected = true?
A: Yes, investigate. Could indicate DB issues.
   Run verification script to see pattern.

---

## 🎯 SUMMARY

✅ Fixed: Multiple separate metrics tracked
✅ Fixed: GET endpoint verifies actual DB count  
✅ Fixed: Mismatch detection and logging
✅ Fixed: All metrics returned to frontend

🚀 Result: Full transparency on donor notifications

EOF

echo ""
echo "For detailed analysis, see: DONOR_COUNT_ANALYSIS.md"
echo "For implementation details, see: DONOR_COUNT_FIX_SUMMARY.md"
echo ""
