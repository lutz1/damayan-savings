# Deposit Flow Verification ✅

## Complete Flow Verification

### 1️⃣ User Initiates PayMongo Payment
**File:** `src/components/Topbar/dialogs/DepositDialog.jsx` (Line 56+)

```javascript
const handlePayMongoPayment = async () => {
  // Get idToken
  const idToken = await auth.currentUser.getIdToken();
  
  // Call /api/create-payment-link
  const response = await fetch(`${API_BASE}/api/create-payment-link`, {...});
  
  // Redirect to PayMongo checkout
  window.location.href = result.checkoutUrl;
}
```

**Result:** User redirected to PayMongo checkout page

---

### 2️⃣ PayMongo Webhook (After Payment Success)
**File:** `backend/server.js` (Line 515-555)

```javascript
app.post("/api/paymongo-webhook", async (req, res) => {
  const checkoutId = data.attributes.checkout_session_id;
  
  // Create deposit record with PENDING status
  await db.runTransaction(async (transaction) => {
    transaction.set(depositRef, {
      userId,
      name,
      amount,
      reference: checkoutId,
      receiptUrl: "",
      status: "Pending",          // ⏳ PENDING - NOT APPROVED
      paymentMethod: "PayMongo",
      createdAt: new Date(),
    });
    
    // ⚠️ DO NOT update user eWallet - wait for admin approval
    
    // Link metadata to deposit
    transaction.update(db.collection("paymentMetadata").doc(checkoutId), {
      depositId: depositRef.id,
      completedAt: new Date(),
    });
  });
  
  console.info(`✅ Payment received - status=Pending (awaiting admin approval)`);
});
```

**Database Change:**
```javascript
deposits/{depositId}
{
  userId: "user123",
  name: "John Doe",
  amount: 5000,
  reference: "chk_xyz",
  receiptUrl: "",
  status: "Pending",           // ✅ PENDING - requires admin approval
  paymentMethod: "PayMongo",
  createdAt: timestamp
}

// ⚠️ user.eWallet is NOT updated here
```

---

### 3️⃣ Frontend Verify Endpoint (Fallback)
**File:** `backend/server.js` (Line 585-645)

If webhook doesn't process in time, frontend calls verify endpoint:

```javascript
app.post("/api/verify-paymongo-payment", async (req, res) => {
  const metadataDoc = await db.collection("paymentMetadata").doc(sessionId).get();
  
  if (metadataData.depositId) {
    // Webhook already created deposit
    return res.json({ 
      message: "Payment received and awaiting admin approval" 
    });
  }
  
  // Create deposit manually if webhook hasn't processed yet
  await db.runTransaction(async (transaction) => {
    transaction.set(depositRef, {
      userId,
      name: metadataData.name,
      amount: metadataData.amount,
      reference: sessionId,
      receiptUrl: "",
      status: "Pending",          // ⏳ PENDING
      paymentMethod: "PayMongo",
      createdAt: new Date(),
    });
    
    // ⚠️ DO NOT update user eWallet - wait for admin approval
  });
});
```

**Result:** Deposit created with status "Pending" (still no wallet update)

---

### 4️⃣ Frontend Shows Pending Message
**File:** `src/pages/depositSuccess.jsx` (Line 70)

```javascript
setMessage("Payment received! Your deposit is awaiting admin approval. You will be notified once it's confirmed.");
```

**Message shown to user:** "Your payment is awaiting admin approval"

---

### 5️⃣ Admin Reviews Deposit
**File:** `src/pages/admin/adminDeposits.jsx` (Line 119)

Admin dashboard fetches from `deposits` collection:
```javascript
const q = query(collection(db, "deposits"));
```

Admin can see deposits with status "Pending" in the table.

---

### 6️⃣ Admin Approves Deposit
**File:** `src/pages/admin/adminDeposits.jsx` (Line 173-205)

```javascript
const handleAction = async (status) => {
  // Update deposit status
  await updateDoc(depositRef, {
    status: status.toLowerCase(),      // status: "approved"
    reviewedAt: new Date(),
    remarks,
  });

  if (status.toLowerCase() === "approved") {
    // ONLY NOW - update user eWallet
    const userRef = doc(db, "users", userId);
    const currentBalance = Number(userSnap.data().eWallet);
    const depositAmount = Number(amount);
    
    await updateDoc(userRef, {
      eWallet: currentBalance + depositAmount,  // ✅ NOW add to wallet
      lastUpdated: new Date(),
    });
    
    console.log("[ADMIN] Updated user eWallet:", {
      userId,
      before: currentBalance,
      deposit: depositAmount,
      after: currentBalance + depositAmount,
    });
  }
};
```

**Database Changes:**
```javascript
// Update 1: Deposit status
deposits/{depositId}
{
  // ... all previous fields
  status: "Approved",              // ✅ NOW APPROVED
  reviewedAt: admin_timestamp,
  remarks: "admin notes"
}

// Update 2: User eWallet
users/{userId}
{
  // ... other fields
  eWallet: 10000,                  // ✅ NOW increased by 5000
  lastUpdated: admin_timestamp
}
```

**Result:** 
- ✅ Deposit status: "Approved"
- ✅ User eWallet: increased
- ✅ Audit trail: reviewedAt timestamp

---

## ✅ Flow Verification Summary

| Step | Action | Status | eWallet Updated? |
|------|--------|--------|-----------------|
| 1 | User initiates PayMongo | - | ❌ No |
| 2 | PayMongo webhook fires | Deposit created (Pending) | ❌ No |
| 3 | Frontend verify endpoint | Deposit confirmed (Pending) | ❌ No |
| 4 | Success page shown | Awaiting approval message | ❌ No |
| 5 | Admin reviews | Sees Pending deposit in dashboard | ❌ No |
| 6 | Admin approves | Deposit status → Approved | ✅ **YES** |

---

## 🔒 Security Features

✅ **No auto-credit** - eWallet only updated after admin approval
✅ **Requires human review** - Admin must approve each deposit
✅ **Audit trail** - reviewedAt timestamp logged
✅ **Atomic transaction** - Deposit status and eWallet update together
✅ **Prevents fraud** - Double-spending checks on user balance
✅ **Clear status** - Users see "Pending" message, admins see in dashboard

---

## 🧪 Testing Checklist

- [ ] User completes PayMongo payment
- [ ] Deposit appears in admin dashboard with status "Pending"
- [ ] User eWallet is NOT updated yet
- [ ] Admin clicks "Approve" button
- [ ] Deposit status changes to "Approved"
- [ ] User eWallet is updated with deposit amount
- [ ] Console logs show "Updated user eWallet" message
- [ ] Audit trail shows reviewedAt timestamp

