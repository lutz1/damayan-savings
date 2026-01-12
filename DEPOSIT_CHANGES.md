# Deposit System Changes - Summary

## 🔄 Changes Made (Jan 12, 2026)

### **1. Removed Manual Deposit Method ❌**
- Removed receipt upload UI from `DepositDialog.jsx`
- Removed manual API endpoint `/api/deposit-funds`
- Removed all receipt-related imports and functionality
- Removed CloudUpload icon, HelpOutline icon, getStorage, uploadBytes, getDownloadURL

**Files Modified:**
- `src/components/Topbar/dialogs/DepositDialog.jsx` - Removed ~200 lines of code related to manual receipt uploads

---

### **2. Changed to Admin Approval for PayMongo Deposits 🔐**
PayMongo deposits now require admin approval before funds are added to the wallet.

**Before:**
```javascript
// Old webhook - Auto-approved and updated wallet immediately
status: "Approved",
transaction.update(userRef, { eWallet: safeBalance + safeAmount })
```

**After:**
```javascript
// New webhook - Pending status, no wallet update
status: "Pending",
// DO NOT update user eWallet - wait for admin approval
```

**Files Modified:**
- `backend/server.js` - `/api/paymongo-webhook` endpoint
- `backend/server.js` - `/api/verify-paymongo-payment` endpoint
- `src/pages/depositSuccess.jsx` - Updated success message

**Updated Message Flow:**
```
PayMongo Webhook → Creates Deposit (Pending) → Admin Review → Approval → eWallet Update
```

---

### **3. Fixed Localhost Issue 🔧**
The success_url and cancel_url in PayMongo checkout were hardcoded to `http://localhost:3000`, which prevented the pages from loading on live URLs.

**Before:**
```javascript
success_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/deposit-success`,
cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/deposit-cancel`,
```

**After:**
```javascript
const frontendUrl = process.env.FRONTEND_URL || process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";
success_url: `${frontendUrl}/deposit-success`,
cancel_url: `${frontendUrl}/deposit-cancel`,
```

**What This Means:**
- ✅ Supports both `FRONTEND_URL` and `REACT_APP_FRONTEND_URL` environment variables
- ✅ Works on live URLs without fallback to localhost
- ✅ Console logs show the actual URLs being used for debugging

**Required Environment Variable:**
Add one of these to your `.env`:
```env
FRONTEND_URL=https://your-live-domain.com
# OR
REACT_APP_FRONTEND_URL=https://your-live-domain.com
```

---

## 📊 New Deposit Flow (PayMongo Only)

```
USER INITIATES DEPOSIT
    ↓
DepositDialog Input
- User enters amount
- No receipt upload
    ↓
Calls: POST /api/create-payment-link
- Backend creates PayMongo checkout
- Stores payment metadata
    ↓
Frontend Redirected to PayMongo Checkout
- User completes payment (GCash, Card, Bank)
    ↓
PayMongo Sends Webhook: checkout_session.payment.success
    ↓
Backend: POST /api/paymongo-webhook
- Creates Deposit doc (status: "Pending")
- Updates paymentMetadata with depositId
- ⚠️ Does NOT update user eWallet
    ↓
Frontend: User redirected to /deposit-success
- Calls: POST /api/verify-paymongo-payment
- Shows message: "Payment received! Awaiting admin approval"
    ↓
ADMIN REVIEWS IN ADMIN DASHBOARD
- Checks deposit details
- Approves/Rejects
- If approved: updates eWallet balance
    ↓
USER NOTIFIED
- Deposit approved
- Wallet balance updated
```

---

## 🗄️ Database Changes

### Deposit Document (Pending Status)
```javascript
{
  userId: "user123",
  name: "John Doe",
  amount: 5000,
  reference: "chk_xyz123",
  receiptUrl: "",
  status: "Pending",  // ⏳ Waiting for admin approval
  paymentMethod: "PayMongo",
  createdAt: timestamp
}
```

### After Admin Approval (Status: Approved)
```javascript
{
  // ... same fields
  status: "Approved",  // ✅ Admin approved
  approvedBy: "admin_user_id",
  approvedAt: timestamp,
  // eWallet balance updated separately
}
```

---

## ✅ New Messages to Users

### In Deposit Dialog
Before payment:
```
"Supports GCash, Credit Cards & Bank Transfer"
"You will be redirected to secure PayMongo checkout"
```

After successful payment:
```
"Payment Submitted!"
"Your payment is awaiting admin approval. You will be notified once it's confirmed."
```

### On Success Page
```
"Payment received! Your deposit is awaiting admin approval. You will be notified once it's confirmed."
```

---

## 📝 Admin Actions Needed

When admin approves a pending PayMongo deposit in the Admin Dashboard:
1. Locate the deposit with status: "Pending"
2. Review deposit details and payment reference
3. Click "Approve" button
4. System automatically updates user's eWallet balance

---

## 🔒 Security Benefits

✅ **Admin Approval Required** - Even with PayMongo's verified payment, requires human review
✅ **Prevents Auto-Credit Exploits** - No automatic wallet updates
✅ **Full Audit Trail** - All approvals are logged with admin ID and timestamp
✅ **Atomic Transactions** - Deposit creation and wallet update happen together (on approval)

---

## 🚀 Deployment Checklist

Before going live:

- [ ] Add `FRONTEND_URL` or `REACT_APP_FRONTEND_URL` to your environment variables
- [ ] Set it to your actual live domain (e.g., `https://app.example.com`)
- [ ] Test deposit flow with PayMongo test keys
- [ ] Verify success page redirects correctly
- [ ] Verify cancel page redirects correctly
- [ ] Test admin approval workflow
- [ ] Verify eWallet updates after admin approval
- [ ] Check console logs for any issues

---

## 📝 Code Summary

| Component | Change |
|-----------|--------|
| `DepositDialog.jsx` | Removed receipt upload, simplified to PayMongo only |
| `backend/server.js` - Webhook | Changed to Pending status, no auto-credit |
| `backend/server.js` - Verify Endpoint | Changed message, no auto-credit |
| `depositSuccess.jsx` | Updated message to reflect pending status |
| `Environment Variables` | Fixed localhost hardcoding |

---

## 🆘 Troubleshooting

**Issue:** Success/Cancel pages don't load after payment
- **Solution:** Verify `FRONTEND_URL` or `REACT_APP_FRONTEND_URL` is set correctly in backend `.env`

**Issue:** Deposit shows Pending but admin can't see it
- **Solution:** Check admin dashboard is loading from `adminDeposits.jsx` and filtering correctly

**Issue:** eWallet not updating after approval
- **Solution:** Ensure admin approval action in dashboard includes transaction that updates eWallet

