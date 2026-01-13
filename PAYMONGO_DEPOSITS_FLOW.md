# PayMongo Deposits - Complete Flow & Setup

## Current Status
✅ Backend deposit creation logic is ready  
✅ Admin deposits UI and approval system is ready  
✅ Frontend client-side fallback is ready  
⚠️ PayMongo webhook needs to be configured correctly

---

## How Deposits Flow

### Step 1: User Initiates Deposit
**Page**: `/member/dashboard` → Click "Deposit"  
**Component**: `src/components/Topbar/dialogs/DepositDialog.jsx`

- User enters amount (₱100+)
- Frontend calls `/api/create-payment-link`
- Backend creates PayMongo checkout session
- Checkout ID stored in `paymentMetadata` collection
- User redirected to PayMongo checkout page

### Step 2: Payment Confirmation
User completes payment on PayMongo → **2 WAYS** deposit gets recorded:

#### Method A: PayMongo Webhook (Best)
```
PayMongo sends webhook to: /api/paymongo-webhook
↓
Backend receives payment.success event
↓
Backend reads paymentMetadata using checkoutId
↓
Backend creates deposit record in Firestore
↓
Status: "Pending" (awaiting admin approval)
```

#### Method B: Client-Side Fallback (If Webhook Fails)
```
User redirected to: /deposit-success
↓
Frontend tries to verify via: /api/verify-paymongo-payment
↓
If backend unreachable → Frontend fallback
↓
Frontend creates deposit directly in Firestore
↓
Status: "Pending" (awaiting admin approval)
```

### Step 3: Admin Approves Deposit
**Page**: `/admin/deposits`

- Admin sees all pending deposits
- Clicks "Approve / Reject" button
- Selects "Approve" → eWallet updated + status changed to "Approved"
- User's eWallet balance increases

---

## Deposit Record Structure

When deposit is created, it looks like this in Firestore:

```javascript
{
  id: "auto-generated-id",
  userId: "user-firebase-uid",
  name: "User Name",
  amount: 600,                      // ₱600 deposit
  reference: "cs_xxx...",           // PayMongo checkoutId
  receiptUrl: "",                   // For manual receipts
  status: "Pending",                // Pending, Approved, Rejected
  paymentMethod: "PayMongo",        // Track payment method
  charge: 0,                        // Optional admin fee
  netAmount: 600,                   // Amount after fees (if any)
  type: "Online Deposit",           // Optional transaction type
  createdAt: Timestamp,
  reviewedAt: Timestamp (after approval),
  remarks: ""                       // Admin notes
}
```

---

## Admin Approval Process

### In Admin Panel
```
adminDeposits.jsx → Deposits Table
    ↓
Filter by Status: Pending, Approved, Rejected
    ↓
Click "Approve / Reject" button
    ↓
Dialog opens → Select status
    ↓
Click confirm
    ↓
TWO THINGS HAPPEN:
  1. Deposit status updated to "Approved"
  2. User eWallet increased by deposit amount
```

### What Gets Updated
**In `deposits` collection**:
- `status`: "Pending" → "Approved"
- `reviewedAt`: Current timestamp
- `remarks`: Admin notes (optional)

**In `users` collection**:
- `eWallet`: Added deposit amount
- `lastUpdated`: Current timestamp

---

## Troubleshooting

### Deposit Not Appearing in Admin Panel

**Check 1: Is the deposit in Firestore?**
```
Firebase Console → Firestore Database → deposits collection
→ Look for documents with userId that matches the user
```

**Check 2: Is the paymentMetadata stored?**
```
Firebase Console → paymentMetadata collection
→ Should have document with checkoutId
→ Should contain: { userId, amount, name, email, createdAt }
```

**Check 3: Is the webhook being triggered?**
```
Render logs → Search for: "[paymongo-webhook]"
→ Should show: "🔄 Webhook payload received"
```

**If webhook logs are empty:**
- PayMongo might not have the correct webhook URL configured
- Check PayMongo Dashboard → Developers → Webhooks
- URL should be: `https://your-backend-url/api/paymongo-webhook`

### Backend Is Offline But Deposit Still Needs to Be Recorded

✅ **This is now handled!**
- Frontend automatically creates deposit using client-side fallback
- Deposit appears in admin panel with status "Pending"
- Admin can approve and update eWallet as normal

---

## PayMongo Webhook Configuration

### Setting Up the Webhook

1. **Login to PayMongo Dashboard**
   - Go to: https://dashboard.paymongo.com

2. **Navigate to Developers → Webhooks**
   - Click "Add Webhook"

3. **Enter the Webhook URL**
   - **Development**: `http://localhost:5000/api/paymongo-webhook`
   - **Production**: `https://your-render-url.onrender.com/api/paymongo-webhook`

4. **Select Events to Subscribe**
   - ✅ `checkout_session.payment.success`
   - (Optional) `checkout_session.payment.failed`

5. **Save and Test**
   - Make a test deposit
   - Check Render logs: `[paymongo-webhook] ✅ DEPOSIT CREATED`

### Expected Webhook Payload Structure

```json
{
  "data": {
    "type": "checkout_session.payment.success",
    "attributes": {
      "checkout_session_id": "cs_nUr9zze9zmNRAqo4yc3jwonB",
      "payment_intent": { ... },
      "payments": [ ... ]
    }
  }
}
```

The backend extracts:
- `data.type` = "checkout_session.payment.success"
- `data.attributes.checkout_session_id` = Used as lookup key in paymentMetadata

---

## Testing Checklist

- [ ] **Test 1**: Deposit with backend running
  - Start backend: `cd backend && node server.js`
  - Create deposit
  - Check Render logs: `[paymongo-webhook] ✅ DEPOSIT CREATED`
  - Go to `/admin/deposits` → See deposit with "Pending" status
  - Click "Approve" → User eWallet increases
  - Status changes to "Approved"

- [ ] **Test 2**: Deposit with backend offline
  - Stop backend
  - Create deposit
  - Redirect to `/deposit-success`
  - Should show success message (via client-side fallback)
  - Go to `/admin/deposits` → Deposit still appears
  - Click "Approve" → Works normally

- [ ] **Test 3**: Verify admin approval flow
  - Approve a pending deposit
  - User's eWallet increases by exact amount
  - Status changes to "Approved"
  - Approved deposits show green status in table

---

## Important Notes

### For Free Render Tier
If using free Render:
- Backend may sleep after 15 min of inactivity
- **But deposits will still be created** via client-side fallback
- Admin approval still works (doesn't require backend)
- Only issue: Webhook might not trigger (but fallback handles it)

### For Production
- Upgrade to Render paid tier (~$7/month) for guaranteed uptime
- Or use Vercel + Firebase Functions for payment webhooks
- Configure webhook URL before going live

### Security
- ✅ Only admins can approve deposits
- ✅ Users can't approve their own deposits
- ✅ eWallet only increases when admin explicitly approves
- ✅ Payment already verified by PayMongo before deposit is created

---

## Admin Actions

### Approving a Deposit
```
Admin Panel → Deposits → Select "Pending" status
    ↓
Find user's deposit → Click "Approve / Reject"
    ↓
Dialog shows: "User Name deposited ₱XXXX"
    ↓
Select "Approve" → Click confirm
    ↓
Result:
  • Status → "Approved" (green)
  • User eWallet → +₱XXXX
  • reviewedAt → Current time
```

### Rejecting a Deposit
```
Same dialog → Select "Reject" → Click confirm
    ↓
Result:
  • Status → "Rejected" (red)
  • User eWallet → Unchanged
  • reviewedAt → Current time
  • Remarks → Admin's reason (optional)
```

---

## Reference URLs in Code

- **Frontend Deposit Dialog**: `src/components/Topbar/dialogs/DepositDialog.jsx`
- **Frontend Success Page**: `src/pages/depositSuccess.jsx`
- **Admin Deposits Panel**: `src/pages/admin/adminDeposits.jsx`
- **Backend Endpoints**:
  - POST `/api/create-payment-link`
  - POST `/api/paymongo-webhook`
  - POST `/api/verify-paymongo-payment`

---

**Last Updated**: January 13, 2026  
**Status**: Ready for Testing
