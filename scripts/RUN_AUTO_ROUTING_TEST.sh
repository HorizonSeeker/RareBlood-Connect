#!/usr/bin/env bash

# 🚀 AUTO-ROUTING QUICK TEST GUIDE
# After applying fixes, run these commands

echo "========================================"
echo "🔍 AUTO-ROUTING QUICK TEST"
echo "========================================"
echo ""

# Ensure you're in correct directory
cd "$(dirname "$0")"

echo "📌 STEP 1: Start the development server"
echo "   Run in Terminal 1:"
echo "   npm run dev"
echo ""
echo "   Wait for: ✅ Ready in X seconds"
echo ""

read -p "Press ENTER once dev server is running..."

echo ""
echo "📌 STEP 2: Debug Database Records"
echo "   Run in Terminal 2:"
echo "   node DEBUG_AUTO_ROUTING.js"
echo ""

read -p "Press ENTER when done..."

echo ""
echo "📌 STEP 3: Verify Auto-Routing Status"
echo "   Run in Terminal 2:"
echo "   node VERIFY_AUTO_ROUTING.js"
echo ""

read -p "Press ENTER when done..."

echo ""
echo "📌 STEP 4: Manual Test in Browser"
echo ""
echo "   1. Go to: http://localhost:3000"
echo "   2. Login as Hospital admin"
echo "   3. Create new Blood Request:"
echo "      - Blood Type: O+"
echo "      - Units: 5"
echo "      - Urgency Level: ⭐ CRITICAL (Auto Emergency) ⭐"
echo "      - Submit"
echo ""
echo "   4. Open DevTools Console (F12)"
echo "      Look for: '📤 FRONTEND - Hospital Request Payload:'""
echo "      Check: is_emergency should be: TRUE ✅"
echo ""

read -p "Press ENTER after creating request..."

echo ""
echo "   5. Login as Blood Bank admin (different account)"
echo "   6. Go to Requests section"
echo "   7. Find the Critical request you just created"
echo "   8. Click REJECT"
echo ""
echo "   📊 EXPECTED RESULT:"
echo "      - Status changes to: ⚡ 'Auto-Routing in Progress' ⚡"
echo "      - SOS notification broadcasts to nearby donors"
echo "      - Request forwards to nearest alternative blood bank"
echo ""

read -p "Press ENTER after rejection..."

echo ""
echo "📌 STEP 5: Verify in Server Console"
echo ""
echo "   Check Terminal 1 (dev server) for:"
echo "   ✅ 🔍 REJECTION DEBUG - is_emergency CHECK:"
echo "   ✅ is_emergency value: true"
echo "   ✅ is_emergency type: boolean"
echo "   ✅ 📋 Is Emergency Result: true"
echo "   ✅ 🚨 EMERGENCY REQUEST REJECTED - Triggering AUTO-ROUTING!"
echo "   ✅ ✅ Status changed to: auto_routing"
echo "   ✅ 🚨 AUTO-ROUTING TRIGGERED FOR EMERGENCY REQUEST"
echo ""

read -p "Press ENTER when verified..."

echo ""
echo "📌 STEP 6: Final Database Verification"
echo "   Run in Terminal 2:"
echo "   node VERIFY_AUTO_ROUTING.js"
echo ""
echo "   EXPECTED OUTPUT:"
echo "   ✅ Status is 'auto_routing': YES"
echo "   ✅ Has forwarded_to records: YES"
echo "   ✅ Has SOS broadcast: YES"
echo "   ✅ AUTO-ROUTING IS WORKING CORRECTLY!"
echo ""

echo "========================================"
echo "🎉 TEST COMPLETE!"
echo "========================================"
echo ""
echo "If all checks passed → Auto-routing is FIXED! ✅"
echo ""
