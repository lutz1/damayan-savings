# Capital Share Monthly Profit Calculation Fix

## Problem Identified

**User:** esteraarino@gmail.com  
**Issue:** Monthly Profit showing ₱980, but this was not matching actual unclaimed profits after claiming some profits

### Root Cause

The `processMonthlyProfit` function in `memberCapitalShare.jsx` was **re-accumulating profits on claimed entries**:

1. When user claimed profit:
   - ✅ `profitStatus` set to "Claimed"
   - ✅ Deposit record created in e-wallet
   - ❌ **BUG**: `profit` field was NOT reset to 0

2. When `processMonthlyProfit` ran again:
   - It added new profit to the old claimed profit
   - Reset `profitStatus` back to "Pending"
   - This brought claimed profits back into the total displayed

### Example Scenario

```
Entry created: ₱3,920 capital
Month 1: profit = ₱196 (3920 × 5%)
Month 2: profit = ₱392 (196 × 5% × 2 months)
Month 3: profit = ₱588 (392 × 5% × 3 months)

USER CLAIMS PROFIT (claims ₱588):
✅ Correctly added to wallet
✅ Deposit record created
❌ BUG: profit field still = 588, profitStatus still somehow becomes "Pending"

NEXT MONTH:
❌ Calculated profit = 588 + (3920 × 0.05 × 1) = 588 + 196 = 784
❌ profitStatus reset to "Pending" instead of "Claimed"
❌ UI shows 784 instead of 0
```

## Fixes Applied

### 1. **Backend: Reset Profit to 0 When Claimed** (functions/index.js & backend/server.js)

```javascript
// BEFORE (BUG)
transaction.update(entryRef, {
  profitStatus: "Claimed",
  profitClaimedAmount: numAmount,
  profitClaimedAt: new Date(),
});

// AFTER (FIXED)
transaction.update(entryRef, {
  profitStatus: "Claimed",
  profit: 0,  // ← NEW: Reset profit to prevent re-accumulation
  profitClaimedAmount: numAmount,
  profitClaimedAt: new Date(),
});
```

### 2. **Frontend: Skip Claimed Entries in Profit Calculation** (memberCapitalShare.jsx)

```javascript
// BEFORE (BUG)
if (monthsDue <= 0) return;
const totalProfitToAdd = profitBase * 0.05 * monthsDue;
updates.push({ ... });

// AFTER (FIXED)
if (monthsDue <= 0) return;

// 🔹 Skip if already claimed - don't re-accumulate profit
if (data.profitStatus === "Claimed") return;

const totalProfitToAdd = profitBase * 0.05 * monthsDue;
updates.push({ ... });
```

### 3. **Better UI: Show Profit Breakdown** (CapitalShareProfitBreakdown.jsx)

Created new dialog to show:
- **🟡 Unclaimed Profit**: Per-entry breakdown with amounts
- **✅ Already Claimed**: List of claimed profits with dates
- Clear total summaries

Updated UI buttons:
- "View Breakdown" → Shows detailed profit breakdown by entry
- "Claim Profit" → Opens profit claim dialog

## Files Modified

1. **functions/index.js** (line ~3063) - Reset profit to 0 on claim
2. **backend/server.js** (line ~1213) - Same fix for backend
3. **src/pages/member/memberCapitalShare.jsx**:
   - Line ~269: Added check to skip claimed entries
   - Line ~74: Import new breakdown dialog
   - Line ~85: Add profitBreakdownOpen state
   - Line ~1004: Updated UI labels and buttons
4. **src/pages/member/components/dialogs/CapitalShareProfitBreakdown.jsx** (NEW) - Breakdown dialog

## Files Created

- **debug-capital-share.js** - Diagnostic script to verify discrepancies in Firestore data

### Usage:
```bash
node debug-capital-share.js <userId>
```

This will show:
- Capital share entries and their statuses
- Profit deposits in e-wallet
- Expected vs actual unclaimed profit
- Any discrepancies detected

## Verification Steps

1. Run diagnostic script:
   ```bash
   node debug-capital-share.js "esteraarino@gmail.com_uid"
   ```

2. Check Firestore: `capitalShareEntries` collection for this user
   - All entries with `profitStatus: "Claimed"` should have `profit: 0`

3. Test in app:
   - Create a new capital share entry
   - Wait for profit to accrue (or manually set dates in Firestore for testing)
   - Claim profit once
   - Verify:
     - Entry shows `profitStatus: "Claimed"`
     - Entry's `profit: 0`
     - Monthly profit total decreases correctly
     - No re-accumulation on next calculation

## Expected Behavior After Fix

- ✅ Claimed profits never appear in unclaimed total
- ✅ Profit field resets to 0 when claimed
- ✅ Next month only calculates new profit on active unclaimed entries
- ✅ Breakdown dialog shows which entries contribute to total
- ✅ Historical claimed profits are still visible but don't affect current calculations
