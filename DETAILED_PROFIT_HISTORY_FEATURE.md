# Detailed Profit Claims History Feature

**Date:** April 18, 2026  
**Component:** DetailedProfitClaimsHistory.jsx  
**Purpose:** Provide transparent, detailed profit calculation breakdown for users

## Overview

The Detailed Profit Claims History shows users:
- **Every capital share entry** they've created
- **Exact calculation formulas** for monthly profit rate
- **Time elapsed** since entry creation
- **Expected vs claimed** profits
- **Proof of claim frequency** to verify against entry dates

## Data Displayed Per Entry

### Basic Information
| Field | Description |
|-------|-------------|
| **Entry Date** | When the capital share entry was created |
| **Capital Amount** | Total capital invested (+ lock-in portion if applicable) |
| **Months Elapsed** | How many months since entry date to now |
| **Expiry Date** | When the entry stops accruing profit (1 year from creation) |

### Calculation Breakdown
```
Monthly Profit Rate = Capital × 5% ÷ 12 months

Example:
- Capital: ₱10,000
- Monthly Rate: ₱10,000 × 5% ÷ 12 = ₱41.67/month

- Months Elapsed: 12
- Expected Total: 12 × ₱41.67 = ₱500
```

### Status Information
- **If Claimed:** Shows the claimed amount and claim date
- **If Pending:** Shows current accrued profit and expiry date
- **If Expired:** Red warning - no longer accruing profit

## How to Use

### For Users
1. Click **"View Detailed History"** on Capital Share page
2. Each entry shows as an expandable accordion card
3. Click to expand and see detailed calculations
4. Verify:
   - Your entry dates match your capital share entries
   - Monthly profit calculations are correct (5% per month)
   - Claim dates align with when you claimed profit

### Example Reading

**Entry Created:** Jan 17, 2026  
**Capital:** ₱6,000  
**Status:** ✅ All Claimed  

**Calculation:**
- Monthly Rate (5%): ₱6,000 × 5% ÷ 12 = ₱25/month
- Months Elapsed: 3
- Expected Total: 3 × ₱25 = ₱75

**Claimed:**
- Amount: ₱75
- Date: Jan 20, 2026

✓ **Verified:** User claimed after 3 months at correct calculation

## Benefits

### For Users
- ✅ **Transparency:** See exactly how profit is calculated
- ✅ **Verification:** Check claim dates against entry dates
- ✅ **Audit Trail:** Historical record of all profit claims
- ✅ **Dispute Resolution:** Proof of calculations if questions arise

### For Business
- ✅ **Reduced Support:** Users can self-verify calculations
- ✅ **Data Integrity:** Audit record in blockchain-like view
- ✅ **Trust Building:** Transparent process builds confidence
- ✅ **Compliance:** Clear records for regulatory review

## Technical Details

### Data Fields Required
```javascript
{
  id: string,                    // Entry ID
  amount: number,                // Capital amount
  lockInPortion: number,         // Locked-in portion (if transferred)
  createdAt: Date,               // Entry creation date
  profitStatus: string,          // "Claimed" | "Pending"
  profit: number,                // Current/claimed profit
  profitClaimedAmount: number,   // Amount claimed (if claimed)
  profitClaimedAt: Date,         // Date claimed (if claimed)
}
```

### Component Props
```javascript
<DetailedProfitClaimsHistory
  open={boolean}                 // Dialog open/close
  onClose={function}             // Close handler
  transactionHistory={array}     // Array of entries
/>
```

### Calculations Used

**Monthly Profit Rate:**
```
profitBase = lockInPortion || amount
monthlyRate = profitBase × 0.05 / 12
```

**Months Elapsed:**
```
monthsElapsed = Math.floor((now - createdAt) / milliseconds_per_month)
```

**Expected Total Profit:**
```
expectedProfit = monthlyRate × monthsElapsed
```

**Expiry Check:**
```
expireDate = createdAt + 1 year
isActive = now <= expireDate
```

## Integration in UI

### Capital Share Page Flow
```
Capital Share Page
    ↓
Monthly Profit Card
    ├─ "View Breakdown" button → Shows unclaimed vs claimed summary
    ├─ "View Detailed History" button → Shows this detailed view
    └─ "Claim Profit" button → Opens profit claim dialog
```

### Button Placement
- Located on the "Unclaimed Profit (5%)" card
- Three action buttons:
  1. 🔵 View Breakdown (shows category summary)
  2. 🔵 View Detailed History (shows entry-by-entry with calculations)
  3. 🟠 Claim Profit (allows claiming available profit)

## User Scenarios

### Scenario 1: Verifying Profit Calculation
**User Question:** "Why is my monthly profit ₱1,000?"  
**Solution:**
1. Click "View Detailed History"
2. Expand the relevant entry
3. See calculation: ₱20,000 × 5% ÷ 12 = ₱83.33/month
4. 12 months × ₱83.33 = ₱1,000
✓ **Verified & Clear**

### Scenario 2: Checking Claim Frequency
**User Question:** "How many times did I claim profit?"  
**Solution:**
1. Click "View Detailed History"
2. Look for entries with "✅ All Claimed" status
3. Check the claimed date for each entry
4. Count entries: 1, 2, 3... = 3 times claimed
✓ **History Complete**

### Scenario 3: Debugging Discrepancies
**User Question:** "My profit total doesn't match"  
**Solution:**
1. Click "View Detailed History"
2. For each entry:
   - Verify creation date
   - Calculate: capital × 5% ÷ 12 × months
   - Compare against claimed amount
3. Identify any mismatches
✓ **Root Cause Found**

## Common Questions

**Q: Why does my claimed profit not match the calculation?**  
A: There might be a rounding difference. Calculations use 2 decimal places, but your entry may have been created mid-month.

**Q: What happens when an entry expires?**  
A: After 1 year, the entry stops accruing profit. You'll see a red "EXPIRED" label and the status changes.

**Q: Can I claim profit multiple times?**  
A: Yes! Each month you can claim accrued profit. Each claim shows separately in this history.

**Q: What's the difference between "Breakdown" and "Detailed History"?**  
A:
- **Breakdown:** Summary of total unclaimed vs claimed profit
- **Detailed History:** Entry-by-entry with exact calculations and dates

## Files

- **Component:** `src/pages/member/components/dialogs/DetailedProfitClaimsHistory.jsx`
- **Integration:** `src/pages/member/memberCapitalShare.jsx`
- **Related:** 
  - `CapitalShareProfitBreakdown.jsx`
  - `ProfitHistoryDialog.jsx`

## Future Enhancements

- [ ] Export to PDF report
- [ ] Download CSV of all claims
- [ ] Email proof of claims
- [ ] Blockchain verification link
- [ ] Compare multiple entries side-by-side
- [ ] Profit prediction calculator
- [ ] Tax report generation

---

**Last Updated:** April 18, 2026  
**Status:** ✅ Live  
**Users:** All Capital Share members
