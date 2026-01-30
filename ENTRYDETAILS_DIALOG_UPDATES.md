# EntryDetailsDialog Updates - Transferred Entry Display

## Overview
Updated the EntryDetailsDialog component to clearly show transferred capital share amounts and recalculated profit basis after transfer.

## Changes Made

### 1. ✅ Already Transferred Section
When a capital share entry has been transferred, displays:
- Label: "✅ Already Transferred"
- Amount: The transferred amount in green (e.g., "₱37,500")
- Only shows if `selectedEntry.transferredAmount > 0`

### 2. 📈 Monthly Profit Accrual Basis
Shows different text based on transfer status:
- **Before Transfer**: "Accrues: Every month automatically" (on full amount)
- **After Transfer**: "Accrues on: Remaining lock-in (₱X)" (on lock-in only)
- Color: Orange (FFB74D) for lock-in reminder

### 3. Next Profit Date - Recalculation Note
Shows updated profit calculation for transferred entries:
- Label: "✓ Recalculated on next profit date:"
- Formula: "5% × ₱{lockInPortion} (lock-in) = ₱{monthlyProfit}/month"
- Green alert box (rgba(76, 175, 80, 0.15)) for positive confirmation
- Only shows if entry has been transferred

## User Experience Flow

### Scenario: ₱50,000 Entry with Transfer
1. **Initial State**
   - Lock-in: ₱12,500 (25%)
   - Transferable: ₱37,500 (75%)
   - Monthly Profit: ₱2,500 (5% of ₱50,000)

2. **After Transferring ₱37,500**
   - Dialog shows: "✅ Already Transferred: ₱37,500"
   - Monthly Profit shows: "Accrues on: Remaining lock-in (₱12,500)"
   - Next Profit Note: "5% × ₱12,500 (lock-in) = ₱625/month"
   - Lock-in: Still ₱12,500 (unchanged)

## Technical Implementation

### Data Sources
- `selectedEntry.transferredAmount`: How much was transferred
- `selectedEntry.lockInPortion`: Remaining lock-in amount
- `selectedEntry.nextProfitDate`: When next profit accrues
- Profit calculation: `lockInPortion × 0.05`

### Conditional Rendering
```jsx
{selectedEntry.transferredAmount && selectedEntry.transferredAmount > 0 ? (
  // Show transferred section and updated profit basis
) : null}
```

## Frontend Files Updated
- **src/pages/member/components/dialogs/EntryDetailsDialog.jsx**
  - Added "Already Transferred" section (lines 157-173)
  - Updated "Monthly Profit" section with conditional text (lines 186-195)
  - Added "Recalculated on next profit date" note (lines 305-323)

## Related Backend Logic
See [backend/server.js](backend/server.js):
- **add-capital-share endpoint** (line ~1231): Sets initial `lockInPortion = amount * 0.25`
- **Profit calculation** (line ~147): Uses `lockInPortion` for transferred entries

## Related Frontend Logic
See [src/pages/member/memberCapitalShare.jsx](src/pages/member/memberCapitalShare.jsx):
- **retroactive migration** (line ~192): Updates old entries to 25% lock-in
- **profit calculation** (line ~147): Returns different amounts pre/post-transfer

## Testing Checklist
- [ ] Open entry details dialog for a transferred entry
- [ ] Verify "✅ Already Transferred: ₱X" shows correct amount
- [ ] Verify profit basis shows remaining lock-in amount
- [ ] Verify recalculation note shows correct monthly profit (lock-in × 5%)
- [ ] Test with entries that haven't been transferred (no transferred section)
- [ ] Verify styling matches (green for transferred, orange for lock-in reminder)

## Deployed Status
✅ Changes completed and error-checked
📝 Ready for testing in running application
🚀 Ready to commit and deploy

## Next Steps
1. Start frontend: `npm start`
2. Navigate to Capital Share section
3. Click on a transferred entry to open details dialog
4. Verify all three new/updated sections display correctly
5. Commit changes: `git add -A && git commit -m "Update EntryDetailsDialog to show transferred amounts and recalculated profit"`
