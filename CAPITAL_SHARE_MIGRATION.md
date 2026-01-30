# Capital Share Migration Guide

## Overview
This migration updates all existing `capitalShareEntries` in Firestore to follow the new lock-in logic:
- **Lock-in**: 25% of added amount
- **Transferable**: 75% of added amount
- **Profit**: Initially 5% on full amount, after transfer 5% on remaining lock-in

## Before Migration
Entries may have:
- Tiered lock-in based on cumulative amount (old system)
- Incorrect transferable portions
- Missing lock-in calculations

## After Migration
All entries will have:
- **lockInPortion** = amount × 0.25
- **transferablePortion** = amount × 0.75
- Consistent with new 25% lock-in logic

## How to Run

### Option 1: Via Terminal
```bash
cd backend
node migrate-capital-share.js
```

### Option 2: Via HTTP Endpoint (Add to server.js)
```javascript
app.post("/api/migrate-capital-share", async (req, res) => {
  try {
    const { adminIdToken } = req.body;
    
    // Verify admin
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(adminIdToken);
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists || !["admin", "ceo"].includes(userDoc.data().role.toUpperCase())) {
      return res.status(403).json({ error: "Only admins can run migrations" });
    }

    const result = await migrateCapitalShareEntries();
    res.json(result);
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({ error: "Migration failed" });
  }
});
```

## Example Results

**Entry Before:**
```
{
  id: "entry123",
  amount: 10000,
  lockInPortion: 5000,        // (old tiered system)
  transferablePortion: 5000
}
```

**Entry After:**
```
{
  id: "entry123",
  amount: 10000,
  lockInPortion: 2500,        // 25% of 10000
  transferablePortion: 7500,  // 75% of 10000
  updatedAt: Timestamp
}
```

## Safety Features
✅ Non-destructive - only updates calculated fields
✅ Skips entries already with correct values
✅ Logs all operations for audit trail
✅ Reports errors for manual review
✅ Can be run multiple times safely

## Rollback
If issues occur, Firestore backups can restore previous state. Original `amount` field is never modified.

## Verification
After running migration:
1. Check console output for summary
2. Query a few entries to verify: `lockInPortion = amount × 0.25`
3. Monitor profit calculations for accuracy
4. Users should see correct lock-in and transferable amounts in UI
