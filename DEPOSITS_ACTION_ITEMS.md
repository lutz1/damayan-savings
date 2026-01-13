# Deposits System - Action Items

## ✅ What's Already Done

### Backend (server.js)
- ✅ `/api/create-payment-link` - Creates PayMongo checkout session
- ✅ `/api/paymongo-webhook` - Receives payment success from PayMongo
- ✅ `/api/verify-paymongo-payment` - Fallback verification endpoint
- ✅ Enhanced logging for debugging
- ✅ Error handling for offline scenarios

### Frontend
- ✅ `DepositDialog.jsx` - User enters deposit amount
- ✅ `depositSuccess.jsx` - Handles payment confirmation + client-side fallback
- ✅ `adminDeposits.jsx` - Admin can view, approve, and reject deposits
- ✅ `adminDeposits.jsx` - Approval updates user eWallet automatically

### Firestore
- ✅ `deposits` collection - Stores deposit records
- ✅ `paymentMetadata` collection - Tracks payment sessions
- ✅ Security rules allow admins to approve and users to create their own

---

## 🔴 What's NOT Done Yet (Missing)

The logs show you're getting the webhook call but deposit isn't being created:
```
[2026-01-12T23:54:33.268Z] POST /api/paymongo-webhook
```

**This means**: The endpoint is being called but something is failing silently.

### Possible Issue 1: PayMongo Not Sending Correct Event Type
The webhook might not be configured for the right event. Check:
1. Go to PayMongo Dashboard → Developers → Webhooks
2. Verify you're subscribed to: `checkout_session.payment.success`
3. Webhook URL should be: `https://your-render-url/api/paymongo-webhook`

### Possible Issue 2: Webhook Payload Structure
PayMongo may send a different structure. To debug:
1. The backend now logs the full payload:
   ```
   [paymongo-webhook] 🔄 Webhook payload received: {full JSON}
   ```
2. Check Render logs for the actual payload structure
3. Update backend if structure is different

### Possible Issue 3: Missing Event Subscription
PayMongo may not have your webhook registered. Check:
1. Dashboard → Developers → Webhooks
2. Look for `checkout_session.payment.success` event
3. If missing, create new webhook with that event

---

## 🎯 What You Need to Do

### Step 1: Configure PayMongo Webhook
1. **Go to**: https://dashboard.paymongo.com/
2. **Navigate to**: Developers → Webhooks (or Settings → Webhooks)
3. **Add Webhook** (or update existing):
   - **Endpoint URL**: `https://your-render-url.onrender.com/api/paymongo-webhook`
   - **Events**: Select `checkout_session.payment.success`
4. **Save/Enable** the webhook
5. **Test**: Make a small deposit and check logs

### Step 2: Check Render Logs
After making a test deposit:
```
Render Dashboard → Select your service → Logs
```

You should see:
```
[paymongo-webhook] 🔄 Webhook payload received: {...}
[paymongo-webhook] Webhook type: checkout_session.payment.success
[paymongo-webhook] ✅ DEPOSIT CREATED - user=xxx amount=₱xxx
```

If you see error logs, share them so I can fix the backend.

### Step 3: Test the Complete Flow

**Test Deposit Flow:**
1. Frontend: Dashboard → Deposit
2. Enter amount: ₱100 or more
3. Complete PayMongo payment
4. Should redirect to `/deposit-success`
5. Check admin panel → `/admin/deposits`
6. Should see deposit with "Pending" status
7. Click "Approve" → User eWallet increases

---

## 🛠️ Implementation Checklist

- [ ] **1. Configure PayMongo Webhook**
  - [ ] Go to PayMongo Dashboard
  - [ ] Find Webhooks settings
  - [ ] Add/verify webhook endpoint
  - [ ] Subscribe to `checkout_session.payment.success`
  - [ ] Copy your Render URL (format: `https://xxx.onrender.com`)

- [ ] **2. Test with Backend Running**
  - [ ] Start backend: `cd backend && node server.js`
  - [ ] Make test deposit: ₱100
  - [ ] Check Render logs for success
  - [ ] Verify in admin panel
  - [ ] Approve and check eWallet updated

- [ ] **3. Test with Backend Offline**
  - [ ] Stop backend (Ctrl+C)
  - [ ] Make test deposit: ₱100
  - [ ] Should redirect to success page (fallback works)
  - [ ] Check admin panel (should still appear)
  - [ ] Approve (works because Firestore doesn't need backend)

- [ ] **4. Deploy if Using Free Render**
  - [ ] Get your Render URL: `https://xxx-xxx.onrender.com`
  - [ ] Update PayMongo webhook with that URL
  - [ ] Test both webhook and client-side fallback scenarios

---

## 📝 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `backend/server.js` | Webhook handler + endpoints | ✅ Ready |
| `src/components/Topbar/dialogs/DepositDialog.jsx` | Initiate deposit | ✅ Ready |
| `src/pages/depositSuccess.jsx` | Handle redirect + fallback | ✅ Ready |
| `src/pages/admin/adminDeposits.jsx` | Admin approval UI | ✅ Ready |
| PayMongo Dashboard | Configure webhook | ⏳ **Needs Your Action** |

---

## 🔍 Debug Checklist

If deposits aren't appearing in admin panel:

1. **Is paymentMetadata created?**
   - Firebase Console → `paymentMetadata` collection
   - Should have document with checkoutId
   - Should contain user data

2. **Is webhook being called?**
   - Render Logs → Search `[paymongo-webhook]`
   - Should see: "🔄 Webhook payload received"

3. **Is the payload correct?**
   - Check full payload in logs
   - Look for: `data.type` = `"checkout_session.payment.success"`
   - Look for: `data.attributes.checkout_session_id`

4. **Is deposit being created?**
   - Firebase Console → `deposits` collection
   - Filter by userId
   - Should see document with `status: "Pending"`

5. **Is fallback working?**
   - If webhook fails, check frontend logs
   - `/deposit-success` should show success message
   - Check browser console for errors

---

## 🎓 Understanding the Flow

```
User initiates deposit
    ↓
[DepositDialog] → Calls /api/create-payment-link
    ↓
Backend creates PayMongo checkout
    ↓
Stores metadata in paymentMetadata collection
    ↓
Redirects to PayMongo checkout page
    ↓
User completes payment on PayMongo
    ↓
TWO PARALLEL ACTIONS:
  1. PayMongo sends webhook → /api/paymongo-webhook
  2. PayMongo redirects user → /deposit-success
    ↓
Method 1 (Webhook): Backend creates deposit
Method 2 (Frontend): Frontend creates deposit via fallback
    ↓
Deposit appears in admin panel with "Pending" status
    ↓
Admin approves → User eWallet updated
```

---

## 💡 Next Steps

1. **Today**: Configure PayMongo webhook URL
2. **Today**: Make a test deposit and check logs
3. **If works**: You're done! Deposits are working
4. **If fails**: Share the Render log output so I can debug

---

**Status**: 90% Complete - Waiting for PayMongo webhook configuration  
**Last Updated**: January 13, 2026
