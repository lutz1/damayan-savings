# User Deposit Flow - Complete Overview

## 🔄 High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INITIATES DEPOSIT                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   DepositDialog opens           │
                    │   (src/components/Topbar/      │
                    │    dialogs/DepositDialog.jsx)  │
                    │                                │
                    │   User enters:                 │
                    │   - Amount (₱)                 │
                    │   - PayMongo or Manual Receipt │
                    └────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
         ┌──────────▼──────────┐         ┌───────────▼─────────┐
         │   PayMongo Path     │         │  Manual Receipt Path│
         │   (Online Payment)  │         │  (Manual Upload)    │
         └────────┬────────────┘         └─────────┬───────────┘
                  │                                │
                  │ Frontend:                      │
                  │ 1. Get idToken                 │ 1. Upload receipt to
                  │ 2. Call /api/                  │    Firebase Storage
                  │    create-payment-link         │ 2. Get idToken
                  │                                │ 3. Call /api/
                  ▼                                │    deposit-funds
    ┌─────────────────────────┐                  │
    │ Backend: /api/create-   │                  ▼
    │ payment-link            │         ┌─────────────────────────┐
    │                         │         │ Backend: /api/          │
    │ 1. Verify idToken       │         │ deposit-funds           │
    │ 2. Create PayMongo      │         │                         │
    │    checkout session     │         │ 1. Verify idToken       │
    │ 3. Store payment meta   │         │ 2. Create Deposit doc   │
    │    in paymentMetadata   │         │    (status: Pending)    │
    │    collection           │         │ 3. Return depositId     │
    │ 4. Return checkout URL  │         │                         │
    └──────────┬──────────────┘         └───────────┬─────────────┘
               │                                    │
               │ Frontend:                          │ Frontend:
               │ Redirect to PayMongo checkout      │ Show success
               │                                    │
               ▼                                    ▼
    ┌──────────────────────────┐         ┌─────────────────────────┐
    │ PayMongo Checkout Page   │         │   Admin Reviews (Manual)│
    │ (GCash, Credit Card,     │         │                         │
    │  Bank Transfer)          │         │   - Check receipt       │
    │                          │         │   - Approve/Reject      │
    │ User completes payment   │         │   - Update deposit      │
    │                          │         │     status to Approved  │
    └──────────┬───────────────┘         │   - Update user         │
               │                          │     eWallet balance     │
               │ PayMongo sends webhook   │                         │
               │ to backend:              └─────────────┬───────────┘
               │ checkout_session.                      │
               │ payment.success                        │ (Manual approval)
               ▼                                        ▼
    ┌──────────────────────────────┐      ┌──────────────────────┐
    │ Backend: /api/paymongo-      │      │ Firestore Admin      │
    │ webhook                      │      │ Updates deposits     │
    │                              │      │ collection:          │
    │ 1. Get checkoutId from       │      │ status: "Approved"   │
    │    webhook event             │      │ + updates eWallet    │
    │ 2. Find paymentMetadata      │      └──────────┬───────────┘
    │    doc by checkoutId         │                 │
    │ 3. Create Deposit doc        │                 ▼
    │    (status: Approved)        │      ┌──────────────────────┐
    │ 4. Update user eWallet       │      │  User Wallet Updated │
    │    balance +amount           │      │  Balance increased   │
    │ 5. Mark metadata as          │      │  by deposit amount   │
    │    completed                 │      └──────────────────────┘
    └──────────┬───────────────────┘
               │
               │ Frontend: User redirected to
               │ /deposit-success?session_id=...
               │
               ▼
    ┌──────────────────────────────┐
    │ DepositSuccess Page          │
    │ (src/pages/depositSuccess.   │
    │  jsx)                        │
    │                              │
    │ 1. Extract session_id from   │
    │    URL params or             │
    │    sessionStorage            │
    │ 2. Call /api/verify-         │
    │    paymongo-payment with     │
    │    sessionId                 │
    │ 3. Check if deposit was      │
    │    already created by        │
    │    webhook                   │
    │ 4. If not, create deposit    │
    │    manually                  │
    │ 5. Display success message   │
    └──────────────────────────────┘
```

---

## 📊 Two Deposit Methods

### **Method 1: PayMongo (Automated - Recommended)**
**Best for:** Online/instant deposits

| Step | Component | Action |
|------|-----------|--------|
| 1 | Frontend | User enters amount |
| 2 | Frontend | Calls `/api/create-payment-link` |
| 3 | Backend | Creates PayMongo checkout session, stores metadata |
| 4 | Frontend | Redirects to PayMongo checkout page |
| 5 | User | Completes payment (GCash, Card, Bank) |
| 6 | PayMongo | Sends webhook: `checkout_session.payment.success` |
| 7 | Backend | Creates Deposit (Approved) + Updates eWallet |
| 8 | Frontend | Shows success page |
| 9 | User | Funds available immediately ✅ |

**Key Collections:**
- `paymentMetadata` → Temp record to link checkout to user
- `deposits` → Final record (status: "Approved")
- `users.eWallet` → Updated immediately

---

### **Method 2: Manual Receipt (Requires Admin Approval)**
**Best for:** Manual bank transfers, offline deposits

| Step | Component | Action |
|------|-----------|--------|
| 1 | Frontend | User enters amount + uploads receipt image |
| 2 | Frontend | Uploads receipt to Firebase Storage |
| 3 | Frontend | Calls `/api/deposit-funds` with receipt URL |
| 4 | Backend | Creates Deposit (status: "Pending") |
| 5 | Frontend | Shows "Deposit Submitted" message |
| 6 | Admin | Reviews receipt in Admin Dashboard |
| 7 | Admin | Clicks Approve → updates deposit status |
| 8 | Firestore | Updates user eWallet balance (via admin action) |
| 9 | User | Funds available after approval ⏳ |

**Key Collections:**
- `deposits` → Pending record with receipt URL
- `users.eWallet` → Updated by admin action
- Firebase Storage → Deposit receipt image

---

## 🔐 API Endpoints

### 1. Create Payment Link (PayMongo)
```
POST /api/create-payment-link
Request: {
  idToken: string,
  amount: number,
  name: string,
  email: string
}
Response: {
  success: true,
  checkoutUrl: string,
  checkoutId: string
}
```

### 2. Deposit Funds (Manual Receipt)
```
POST /api/deposit-funds
Request: {
  idToken: string,
  amount: number,
  reference: string (optional),
  receiptUrl: string,
  name: string
}
Response: {
  success: true,
  depositId: string
}
```

### 3. PayMongo Webhook
```
POST /api/paymongo-webhook
Triggered by: PayMongo when payment succeeds
Automatically:
  - Creates Deposit (Approved)
  - Updates user eWallet
  - Links metadata
```

### 4. Verify PayMongo Payment
```
POST /api/verify-paymongo-payment
Request: {
  idToken: string,
  sessionId: string
}
Response: {
  success: true,
  depositId: string,
  message: string
}
Purpose: Confirmation page to ensure deposit was created
```

---

## 📂 Database State Changes

### **PayMongo Flow - Database Updates**

```javascript
// Step 1: Create Payment Metadata (after /api/create-payment-link)
paymentMetadata/{checkoutId}
{
  userId: "user123",
  amount: 5000,
  currency: "PHP",
  checkoutId: "chk_xxx",
  email: "user@example.com",
  name: "John Doe",
  createdAt: timestamp
  // No depositId yet - will add after webhook
}

// Step 2: Webhook Creates Deposit (after payment success)
deposits/{depositId}
{
  userId: "user123",
  name: "John Doe",
  amount: 5000,
  reference: "chk_xxx",
  receiptUrl: "",
  status: "Approved",
  paymentMethod: "PayMongo",
  createdAt: timestamp
}

// Step 3: Update User Wallet
users/{userId}
{
  // ... other fields
  eWallet: 10000,  // increased by 5000
  updatedAt: timestamp
}

// Step 4: Link Metadata to Deposit
paymentMetadata/{checkoutId}
{
  // ... previous fields
  depositId: "depositId123",
  completedAt: timestamp
}
```

### **Manual Receipt Flow - Database Updates**

```javascript
// Step 1: Create Pending Deposit (after /api/deposit-funds)
deposits/{depositId}
{
  userId: "user123",
  name: "John Doe",
  amount: 5000,
  reference: "BANK-REF-12345",
  receiptUrl: "https://storage.com/receipts/image.jpg",
  status: "Pending",  // ⏳ Waiting for admin
  createdAt: timestamp
}

// Step 2: Admin Approves (via Admin Dashboard)
deposits/{depositId}
{
  // ... previous fields
  status: "Approved",  // ✅ Updated by admin
  approvedBy: "admin123",
  approvedAt: timestamp
}

// Step 3: Update User Wallet (triggered by admin approval)
users/{userId}
{
  // ... other fields
  eWallet: 10000,  // increased by 5000 (done by admin)
  updatedAt: timestamp
}
```

---

## 🔍 Key File Locations

| Component | File |
|-----------|------|
| **Deposit Dialog** | [src/components/Topbar/dialogs/DepositDialog.jsx](src/components/Topbar/dialogs/DepositDialog.jsx) |
| **Success Page** | [src/pages/depositSuccess.jsx](src/pages/depositSuccess.jsx) |
| **Cancel Page** | [src/pages/depositCancel.jsx](src/pages/depositCancel.jsx) |
| **Backend Endpoints** | [backend/server.js](backend/server.js#L397-L700) |
| **Firestore Rules** | [firestore.rules](firestore.rules) |
| **Admin Dashboard** | [src/pages/admin/adminDeposits.jsx](src/pages/admin/adminDeposits.jsx) |

---

## ⚙️ Environment Variables Required

```env
# Backend (.env)
PAYMONGO_SECRET_KEY=sk_live_xxxxx
PAYMONGO_PUBLIC_KEY=pk_live_xxxxx
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=5000
FRONTEND_URL=http://localhost:3000

# Frontend (.env)
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=project-id
```

---

## ✅ Success Indicators

### **PayMongo Deposit Success:**
- ✅ User redirected to `/deposit-success`
- ✅ Deposit collection shows status: "Approved"
- ✅ User eWallet balance increased
- ✅ Payment reference visible in deposit logs

### **Manual Deposit Success:**
- ✅ Dialog shows "Deposit Submitted!"
- ✅ Deposit collection shows status: "Pending"
- ✅ Admin sees deposit in admin dashboard
- ✅ After admin approval → eWallet updated

---

## ❌ Error Handling

| Scenario | Handling |
|----------|----------|
| **PayMongo checkout fails** | User redirected to `/deposit-cancel` |
| **Webhook doesn't process** | `/verify-paymongo-payment` creates deposit manually |
| **Invalid receipt (manual)** | Admin rejects in dashboard → status: "Rejected" |
| **Insufficient metadata** | Error returned from backend |
| **Token verification fails** | 401 Unauthorized response |

---

## 🔐 Security Measures

1. **ID Token Verification** → All endpoints verify Firebase idToken
2. **Atomic Transactions** → Deposit + eWallet update happens together
3. **User ID Matching** → Verify userId matches token before updating balance
4. **Firestore Rules** → Only users can read/create their own deposits
5. **Payment Metadata** → Temporary records linking checkout to user
6. **Receipt Storage** → Uploaded to Firebase Storage with access controls

