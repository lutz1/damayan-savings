# Monthly Profit Timeline Display Feature

## Overview
Enhanced the UI to show users a **monthly breakdown of when profits were earned and claimed**, so they can see exactly which months they transferred/claimed profits.

## What Was Changed

### 1. **DetailedProfitClaimsHistory.jsx** - New Monthly Profit Timeline Table
Added a new section that displays a comprehensive table showing:
- **Profit Ready Date**: When each month's profit became available
- **Amount**: How much profit accrued that month (₱500/month at 5%)
- **Status**: Whether the profit was ✅ Claimed or ⏳ Accruing
- **Claim Date**: When the user claimed it (if claimed)

### 2. **Fixed Calculation Formula Display**
Updated from incorrect formula:
```
❌ OLD: ₱10,000 × 5% ÷ 12 months = ₱41.67/month
```

To correct formula:
```
✅ NEW: ₱10,000 × 5% (monthly rate) = ₱500/month
```

## Example: User Scenario

**Entry:** ₱10,000 on Jan 19, 2026

### Monthly Profit Timeline Table

| Profit Ready Date | Amount | Status | Claim Date |
|---|---|---|---|
| Feb 19, 2026 | ₱500 | ✅ Claimed | Mar 4, 2026 |
| Mar 19, 2026 | ₱500 | ⏳ Accruing | - |
| Apr 19, 2026 | ₱500 | ⏳ Accruing | - |

### What User Sees

Users can now:
1. **View "Detailed History"** button in Capital Share card
2. **Expand each entry** to see the monthly breakdown
3. **See a table showing**:
   - Feb 19 → ₱500 ready → Claimed on Mar 4
   - Mar 19 → ₱500 ready → Currently accruing
   - Apr 19 → ₱500 ready → Currently accruing
4. **Understand the timeline**: "I earned ₱500 every month, and I claimed the first ₱500 on March 4"

## Key Features

### ✅ Calculation Display
```
Profit Base: ₱10,000 × 5% (monthly rate)
= ₱500 per month

3 months × ₱500 = ₱1,500 expected
```

### ✅ Monthly Breakdown Table
```
📅 Monthly Profit Timeline

Profit Ready | Amount | Status | Claim Date
Jan 19 → Feb 19 → ₱500 → ✅ Claimed → Mar 4
Jan 19 → Mar 19 → ₱500 → ⏳ Accruing → -
Jan 19 → Apr 19 → ₱500 → ⏳ Accruing → -
```

### ✅ Latest Claim Summary
```
✅ Latest Claim
Profit Claimed: ₱500
Claimed on: Mar 4, 2026
```

## Database Schema (Unchanged)

```jsx
capitalShareEntries: {
  id: "entry_123",
  userId: "user_uid",
  amount: 10000,
  date: Timestamp(Jan 19, 2026),
  profitStatus: "Claimed",        // Status after claim
  profit: 0,                       // Reset after claim
  profitClaimedAmount: 500,        // What was claimed
  profitClaimedAt: Timestamp(Mar 4, 2026), // When claimed
  monthlyProfitRate: 500,          // 5% of capital
}
```

## UI Flow

```
Capital Share Dashboard
    │
    ├─ [View Detailed History] ← Opens modal
    │
    └─ DetailedProfitClaimsHistory Dialog
        │
        ├─ Expand Entry (Jan 19)
        │   │
        │   ├─ 📋 Calculation Formula
        │   │   ₱10,000 × 5% = ₱500/month
        │   │
        │   ├─ 📅 Monthly Profit Timeline
        │   │   ┌─────────────────────────────────────┐
        │   │   │ Profit Ready │ Amount │ Status │ Date│
        │   │   ├─────────────────────────────────────┤
        │   │   │ Feb 19, 2026 │ ₱500  │ ✅Claimed│Mar 4│
        │   │   │ Mar 19, 2026 │ ₱500  │ ⏳Accruing│  - │
        │   │   │ Apr 19, 2026 │ ₱500  │ ⏳Accruing│  - │
        │   │   └─────────────────────────────────────┘
        │   │
        │   └─ ✅ Latest Claim
        │       Profit Claimed: ₱500
        │       Claimed on: Mar 4, 2026
        │
        └─ Still shows months that haven't reached their anniversary
```

## How It Works

1. **On Load**: Component fetches entry with `profitClaimedAt` date
2. **Calculate Timeline**: 
   - Start: entry creation date
   - End: today
   - Generate month-by-month intervals
3. **Determine Status**:
   - If `profitClaimedAt` exists and current month ≤ claim date → **✅ Claimed**
   - Otherwise → **⏳ Accruing**
4. **Display**: Show all months with their calculated profit amounts

## Example Code Logic

```jsx
// Generate timeline from entry creation to today
let currentMonthDate = new Date(entry.createdAt);
while (currentMonthDate <= now) {
  const nextMonthDate = new Date(currentMonthDate);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

  profitTimeline.push({
    readyDate: new Date(currentMonthDate),
    amount: monthlyRate,
    isClaimed:
      entry.profitStatus === "Claimed" &&
      entry.profitClaimedAt &&
      currentMonthDate <= new Date(entry.profitClaimedAt),
    claimDate:
      entry.profitStatus === "Claimed" &&
      entry.profitClaimedAt &&
      currentMonthDate <= new Date(entry.profitClaimedAt)
        ? new Date(entry.profitClaimedAt)
        : null,
  });

  currentMonthDate = nextMonthDate;
}
```

## Files Modified

- [src/pages/member/components/dialogs/DetailedProfitClaimsHistory.jsx](src/pages/member/components/dialogs/DetailedProfitClaimsHistory.jsx)
  - Added monthly profit timeline table
  - Fixed calculation formula display
  - Renamed "Claimed" section to "Latest Claim" for clarity

## Build Status

✅ **Build Successful** - All changes compile without errors

## User Benefits

1. **Transparency**: Users see exactly when each month's profit was earned
2. **Claim Tracking**: Clear record of when profits were claimed
3. **Timeline Visibility**: Shows past, current, and future months
4. **Verification**: Users can verify calculations month-by-month
5. **Status Clarity**: 
   - ✅ Claimed (with date)
   - ⏳ Accruing (waiting for claim or next anniversary)

## Example Breakdown

**Given:**
- Entry: ₱10,000 on Jan 19, 2026
- Monthly Rate: 5% = ₱500/month
- Claimed: ₱500 on Mar 4, 2026
- Today: Apr 18, 2026

**What User Sees:**
```
Monthly Profit Timeline

Date Earned    Amount  Status          Claimed Date
Feb 19, 2026   ₱500   ✅ Claimed       Mar 4, 2026
Mar 19, 2026   ₱500   ⏳ Accruing      -
Apr 19, 2026   ₱500   ⏳ Accruing      -

Calculation: ₱10,000 × 5% = ₱500/month
Expected Total: 3 months × ₱500 = ₱1,500
Latest Claim: ₱500 on Mar 4, 2026
Current Accrued: ₱1,000 (awaiting claim)
```

---

This feature ensures users have complete visibility into their monthly profit earnings and claim history!
