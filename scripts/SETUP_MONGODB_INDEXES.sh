#!/bin/bash
# MongoDB Index Setup Script for Emergency SOS System
# Run this script or execute commands in MongoDB CLI

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Emergency SOS MongoDB Index Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Note: This script shows the commands but must be run in MongoDB CLI
# Because MongoDB connections are not standard shell commands

echo -e "${YELLOW}"
echo "⚠️  MongoDB Indexes MUST be created in MongoDB CLI or MongoDB Compass"
echo "⚠️  Copy and paste commands below into your MongoDB client"
echo -e "${NC}"

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}1. DONER MODEL - GEOSPATIAL INDEXES (CRITICAL)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "🔍 Create 2dsphere index for location-based queries:"
echo "db.doners.createIndex({ \"current_location\": \"2dsphere\" })"
echo ""

echo "🔍 Create compound index (blood_type + location + active):"
echo "db.doners.createIndex({ \"blood_type\": 1, \"current_location\": \"2dsphere\", \"is_active\": 1 })"
echo ""

echo "🔍 Verify indexes created:"
echo "db.doners.getIndexes()"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}2. HOSPITAL REQUEST MODEL - STATUS INDEXES${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "🔍 Index for hospital_id + status queries:"
echo "db.hospitalrequests.createIndex({ \"hospital_id\": 1, \"status\": 1 })"
echo ""

echo "🔍 Index for bloodbank_id + status queries:"
echo "db.hospitalrequests.createIndex({ \"bloodbank_id\": 1, \"status\": 1 })"
echo ""

echo "🔍 Index for sorting by creation date:"
echo "db.hospitalrequests.createIndex({ \"created_at\": -1 })"
echo ""

echo "🔍 Index for emergency geosearch queries:"
echo "db.hospitalrequests.createIndex({ \"geosearch_triggered\": 1 })"
echo ""

echo "🔍 Index for filtering emergency requests:"
echo "db.hospitalrequests.createIndex({ \"is_emergency\": 1 })"
echo ""

echo "🔍 Verify indexes:"
echo "db.hospitalrequests.getIndexes()"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}3. DONOR CONTACT REQUEST MODEL - TRACKING INDEXES${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "🔍 Index for donor status lookups:"
echo "db.donorcontactrequests.createIndex({ \"donorId\": 1, \"status\": 1 })"
echo ""

echo "🔍 Index for requester lookups:"
echo "db.donorcontactrequests.createIndex({ \"requesterId\": 1, \"status\": 1 })"
echo ""

echo "🔍 Index for request tracking:"
echo "db.donorcontactrequests.createIndex({ \"requestId\": 1 })"
echo ""

echo "🔍 TTL index for automatic expiry (24 hours):"
echo "db.donorcontactrequests.createIndex({ \"expiresAt\": 1 }, { expireAfterSeconds: 0 })"
echo ""

echo "🔍 Verify indexes:"
echo "db.donorcontactrequests.getIndexes()"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}4. USER MODEL - BLOOD BANK LOCATION INDEX (Optional)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "🔍 2dsphere index for blood bank locations:"
echo "db.users.createIndex({ \"location\": \"2dsphere\" })"
echo ""

echo "🔍 Compound index for role + location:"
echo "db.users.createIndex({ \"role\": 1, \"location\": \"2dsphere\" })"
echo ""

echo "🔍 Verify indexes:"
echo "db.users.getIndexes()"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}5. DATA VALIDATION QUERIES${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "✅ Check if donors have location data:"
echo "db.doners.find({ \"current_location\": { \$exists: true, \$ne: null } }).count()"
echo ""

echo "✅ Check if donors have FCM tokens:"
echo "db.users.find({ fcmToken: { \$exists: true, \$ne: null } }).count()"
echo ""

echo "✅ Check geosearch index efficiency:"
echo "db.doners.find({ blood_type: \"O+\", \"current_location\": { \$near: { \$geometry: { type: \"Point\", coordinates: [106.6817, 10.8578] }, \$maxDistance: 10000 } } }).explain(\"executionStats\")"
echo ""

echo "✅ Check emergency requests created:"
echo "db.hospitalrequests.find({ is_emergency: true }).count()"
echo ""

echo "✅ Check successful broadcasts:"
echo "db.hospitalrequests.find({ geosearch_triggered: true, donors_notified: { \$gt: 0 } }).count()"
echo ""

echo "✅ Check failed geocoding:"
echo "db.hospitalrequests.find({ sos_broadcast_status: \"geocoding_failed\" }).count()"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}6. DONOR LOCATION SETUP${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "⚠️  Update existing donors with location data:"
echo "db.doners.updateMany({ \"current_location\": { \$exists: false } }, { \$set: { \"current_location\": { type: \"Point\", coordinates: [106.6817, 10.8578] } } })"
echo ""

echo "✅ Verify all donors have location:"
echo "db.doners.find({ \"current_location\": { \$exists: false } }).count()"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}7. QUICK REFERENCE - PASTE THESE INTO MONGODB CLI${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

cat << 'EOF'
# Copy all below and paste into MongoDB CLI at once

// Doner indexes
db.doners.createIndex({ "current_location": "2dsphere" });
db.doners.createIndex({ "blood_type": 1, "current_location": "2dsphere", "is_active": 1 });

// HospitalRequest indexes
db.hospitalrequests.createIndex({ "hospital_id": 1, "status": 1 });
db.hospitalrequests.createIndex({ "bloodbank_id": 1, "status": 1 });
db.hospitalrequests.createIndex({ "created_at": -1 });
db.hospitalrequests.createIndex({ "geosearch_triggered": 1 });
db.hospitalrequests.createIndex({ "is_emergency": 1 });

// DonorContactRequest indexes
db.donorcontactrequests.createIndex({ "donorId": 1, "status": 1 });
db.donorcontactrequests.createIndex({ "requesterId": 1, "status": 1 });
db.donorcontactrequests.createIndex({ "requestId": 1 });
db.donorcontactrequests.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

// User indexes (optional)
db.users.createIndex({ "location": "2dsphere" });
db.users.createIndex({ "role": 1, "location": "2dsphere" });

// Update existing donors with location (TP.HCM coordinates)
db.doners.updateMany({ "current_location": { $exists: false } }, { $set: { "current_location": { type: "Point", coordinates: [106.6817, 10.8578] } } });

// Verify
db.doners.getIndexes();
db.hospitalrequests.getIndexes();
db.donorcontactrequests.getIndexes();
EOF

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}INSTRUCTIONS:${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Open MongoDB Compass or MongoDB CLI"
echo "2. Connect to your database"
echo "3. Select the correct database (usually 'rareblood_connect')"
echo "4. Copy the commands from section 7 above"
echo "5. Paste into MongoDB CLI Console"
echo "6. All indexes will be created"
echo ""

echo -e "${YELLOW}VERIFICATION:${NC}"
echo ""
echo "After running the commands, verify indexes with:"
echo "  db.doners.getIndexes()"
echo "  db.hospitalrequests.getIndexes()"
echo "  db.donorcontactrequests.getIndexes()"
echo ""

echo -e "${YELLOW}TROUBLESHOOTING:${NC}"
echo ""
echo "If you see errors:"
echo "  1. Check database name is correct"
echo "  2. Verify collection names (should be lowercase)"
echo "  3. Ensure indexes don't already exist"
echo "  4. Check MongoDB version (2.4+ required for 2dsphere)"
echo ""

echo -e "${GREEN}✅ Index setup guide complete!${NC}"
echo ""
