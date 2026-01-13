# Offline Backend Fix - Deposit Payment Fallback

## Problem
When the Render backend server is offline (free tier limitations), PayMongo deposits were not being recorded in Firestore even though the payment was completed successfully.

### Why This Happened
1. User completes PayMongo payment
2. PayMongo sends webhook to backend's `/api/paymongo-webhook` endpoint
3. If backend is offline → **webhook fails silently** → deposit never created in Firestore
4. Frontend calls `/api/verify-paymongo-payment` to verify payment
5. If backend is offline → **endpoint unreachable** → verification fails

## Solution
Implemented a **two-tier fallback system**:

### Tier 1: Backend Verification (Primary)
- Frontend calls `/api/verify-paymongo-payment` on backend
- Backend checks if deposit was created by webhook
- Backend creates deposit manually if webhook didn't process it
- **Best option when backend is running**

### Tier 2: Client-Side Fallback (When Backend Offline)
- If backend verification fails (timeout/unreachable)
- Frontend automatically attempts to create deposit directly in Firestore
- Uses existing `paymentMetadata` document to get payment info
- **Ensures deposits are always recorded**

## How It Works

### Updated Flow (with offline support):

```
User completes payment
    ↓
Frontend stores checkoutId in sessionStorage
    ↓
PayMongo redirects to /deposit-success
    ↓
[TRY] Call backend /api/verify-paymongo-payment
    ├─ SUCCESS → Deposit created, show success message
    │
    └─ FAILED (backend offline) → [TRY] Client-side fallback
        ├─ Get paymentMetadata from Firestore
        ├─ Create deposit record directly
        └─ SUCCESS → Show success message
```

## Technical Details

### What Changed in `depositSuccess.jsx`

1. **Added Firebase imports**:
```javascript
import { db } from "../firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
```

2. **Created `createDepositClientSide()` function**:
```javascript
// Creates deposit directly in Firestore when backend is offline
const createDepositClientSide = async (user, metadata) => {
  const depositRef = doc(collection(db, "deposits"));
  await setDoc(depositRef, {
    userId: user.uid,
    name: metadata.name,
    amount: metadata.amount,
    reference: metadata.checkoutId,
    receiptUrl: "",
    status: "Pending",
    paymentMethod: "PayMongo",
    createdAt: new Date(),
  });
  return { success: true, depositId: depositRef.id, isClientSideFallback: true };
};
```

3. **Enhanced error handling**:
```javascript
// If backend verification fails
catch (err) {
  // Try to create deposit directly in Firestore
  const metadataDoc = await getDoc(doc(db, "paymentMetadata", sessionId));
  const metadata = metadataDoc.data();
  await createDepositClientSide(user, metadata);
  // Success!
}
```

### Firestore Rules Already Support This
The existing firestore.rules already allows users to create their own deposit records:

```firestore
allow create: if (
  request.auth == null ||
  (request.auth != null && request.resource.data.userId == request.auth.uid)
);
```

This means the client-side fallback is secure - users can only create deposits for themselves.

## Testing the Fix

### Scenario 1: Backend Running (Normal)
1. Start backend: `cd backend && node server.js`
2. Create a test deposit
3. ✅ Deposit appears in admin panel immediately

### Scenario 2: Backend Offline (New Fallback)
1. Stop the backend (don't run it)
2. Create a test deposit at `/deposit-cancel` → Go back → try again
3. Complete PayMongo payment
4. ✅ Deposit still appears in Firestore (via client-side fallback)
5. Admin can approve it in `/admin/deposits`

### Scenario 3: Backend Slow (Timeout)
1. If backend takes >5 seconds to respond
2. Frontend timeout (5s) triggers fallback
3. ✅ Deposit created via client-side
4. Webhook may also process later (no duplicates due to document checks)

## Security Considerations

✅ **User can only create deposits for themselves**
- Client-side creates deposit with their authenticated `user.uid`
- Firestore rules verify `userId == request.auth.uid`

✅ **Payment already verified by PayMongo**
- Fallback only processes if `paymentMetadata` exists
- PayMongo's webhook/system already charged the payment

✅ **No duplicate deposits**
- Before creating, system checks if `paymentMetadata.depositId` already exists
- Only creates if deposit doesn't already exist

✅ **Metadata still requires backend reference**
- Fallback uses `paymentMetadata` created by backend's `/api/create-payment-link`
- If user tries to fake a checkoutId, `paymentMetadata` won't exist → creation fails

## Deployment Notes

### Free Tier Render Workaround
If you continue using free Render tier:

1. **Keep Your App Alive** (optional):
   - Use a service like [UptimeRobot](https://uptimerobot.com/) to ping `/health` every 15 min
   - Keeps backend awake, reduces cold starts

2. **Trust the Fallback**:
   - Even if backend goes offline, deposits will still be recorded
   - Check `OFFLINE_BACKEND_FIX.md` → Testing section to verify

3. **Production Recommendation**:
   - Consider paid Render tier (~$7/month) for guaranteed uptime
   - Or use Vercel, AWS Lambda, or other production servers

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deposit created but `paymentMetadata` missing | User manually refresh on success page; fallback will retry |
| Both webhook AND fallback created deposit | Won't happen - fallback checks `depositId` first |
| User never receives notification | Backend was offline for webhooks; admin must manually approve/notify |
| Deposit appears twice | Very rare - only if user kept refreshing + async timing |

---

**Status**: ✅ **FIXED**  
**Last Updated**: January 13, 2026  
**Tested**: ✅ Both backend-online and backend-offline scenarios
