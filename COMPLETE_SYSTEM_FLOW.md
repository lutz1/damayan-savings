# Amayan Savings - Complete System Flow

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AMAYAN SAVINGS ECOSYSTEM                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐         ┌──────────────┐      ┌─────────────┐ │
│  │   FRONTEND  │────────>│   FIRESTORE  │<─────│   BACKEND   │ │
│  │  (React)    │         │  (Database)  │      │  (Node.js)  │ │
│  └─────────────┘         └──────────────┘      └─────────────┘ │
│        │                        │                      │         │
│        │                        │                      │         │
│        v                        v                      v         │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │ User Auth    │      │ Collections  │      │ API Endpoints│  │
│  │ (Email/Pass) │      │ (Users,      │      │ (Transfer,   │  │
│  │              │      │  Wallet,     │      │  Deposits,   │  │
│  │              │      │  Referral)   │      │  Rewards)    │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. USER REGISTRATION & INVITATION FLOW

### A. Existing Member Invites New User

```
MEMBER DASHBOARD
    │
    ├─ Click "Invite & Earn"
    │   ├─ InviteEarnDialog opens
    │   ├─ Fill form:
    │   │   ├─ New user name/email
    │   │   ├─ New user username
    │   │   ├─ New user role (MD, MS, MI, Agent)
    │   │   └─ Select activation code
    │   │
    │   └─ Click "Send Invite"
    │       │
    │       ├─ STEP 1: Validate input
    │       │   ├─ Email format check
    │       │   ├─ Email duplication check
    │       │   └─ Code unused check
    │       │
    │       ├─ STEP 2: Create pending invite
    │       │   └─ pendingInvites collection
    │       │       {
    │       │         inviterId: "member-uid",
    │       │         inviterUsername: "john",
    │       │         inviterRole: "MD",
    │       │         inviteeUsername: "jane",
    │       │         inviteeEmail: "jane@email.com",
    │       │         role: "MS",
    │       │         code: "ABC123",
    │       │         status: "Pending Approval"
    │       │       }
    │       │
    │       ├─ STEP 3: Mark code as used
    │       │   └─ purchaseCodes.used = true
    │       │
    │       ├─ STEP 4: Create direct invite reward
    │       │   └─ referralReward collection
    │       │       {
    │       │         userId: "member-uid",
    │       │         username: "john",
    │       │         amount: 210,  // MD gets ₱210
    │       │         source: "jane",
    │       │         type: "Direct Invite Reward",
    │       │         approved: false,
    │       │         payoutReleased: false
    │       │       }
    │       │
    │       ├─ STEP 5: Create network bonuses
    │       │   └─ For each upline (up to CEO):
    │       │       ├─ MasterMD: ₱15
    │       │       ├─ MD (first only): ₱10
    │       │       ├─ MS: ₱20
    │       │       └─ MI: ₱20
    │       │
    │       └─ STEP 6: Special system bonuses
    │           ├─ Master MD: ₱100
    │           └─ Special emails: ₱50-₱100
    │
    └─ Success: "Invite sent!"
```

### B. Admin Approves Invite

```
ADMIN DASHBOARD → Pending Invites
    │
    ├─ Table shows:
    │   ├─ Invitee name
    │   ├─ Invitee email
    │   ├─ Inviter name
    │   └─ [Approve] [Reject] buttons
    │
    └─ Click [Approve]
        │
        ├─ STEP 1: Create Firebase Auth user
        │   ├─ Email: inviteeEmail
        │   ├─ Password: "password123"
        │   └─ Returns: uid
        │
        ├─ STEP 2: Create user in Firestore
        │   └─ users collection
        │       {
        │         uid: "generated-uid",
        │         username: "jane",
        │         email: "jane@email.com",
        │         role: "MS",
        │         referredBy: "john",
        │         referrerRole: "MD",
        │         eWallet: 0,
        │         capitalShareActive: false
        │       }
        │
        ├─ STEP 3: Approve direct reward
        │   └─ Update referralReward:
        │       {
        │         approved: true,
        │         payoutReleased: true
        │       }
        │
        ├─ STEP 4: Process network bonuses
        │   └─ Mark all upline bonuses as approved
        │
        ├─ STEP 5: Delete pending invite
        │   └─ Remove from pendingInvites
        │
        └─ Mark user referralReward = true
            └─ users[uid].referralReward = true
```

---

## 2. AUTHENTICATION & LOGIN FLOW

```
LOGIN PAGE
    │
    ├─ User enters:
    │   ├─ Email
    │   └─ Password
    │
    └─ Click "Login"
        │
        ├─ Firebase Auth verification
        │   ├─ Get ID token
        │   └─ Returns: uid + user data
        │
        ├─ Fetch user profile from Firestore
        │   └─ users[uid] collection
        │       {
        │         username: "john",
        │         email: "john@email.com",
        │         role: "MD",
        │         eWallet: 5000,
        │         referredBy: "upline-name",
        │         capitalShareActive: true
        │       }
        │
        ├─ Store in localStorage:
        │   ├─ uid
        │   ├─ email
        │   ├─ role
        │   └─ username
        │
        └─ Route based on role:
            ├─ ADMIN/CEO → /admin/dashboard
            ├─ MD/MS/MI → /member/dashboard
            ├─ MERCHANT → /merchant/dashboard
            └─ AGENT → /agent/dashboard
```

---

## 3. WALLET & BALANCE SYSTEM

### A. eWallet Structure

```
users[uid]
    ├─ eWallet: 5000        // Current balance
    ├─ eWalletBalance: 5000  // Alias for eWallet
    └─ [Can be modified by]:
        ├─ Deposits (admin approves)
        ├─ Transfers (wallet-to-wallet)
        ├─ Referral rewards (user claims)
        ├─ Capital share transfers
        └─ Passive income claims
```

### B. Balance Sources

```
MEMBER STARTS WITH:
    ├─ eWallet: ₱0

MEMBER CAN EARN:
    ├─ Direct Invite Reward
    │   ├─ MasterMD: ₱235
    │   ├─ MD: ₱210
    │   ├─ MS: ₱160
    │   ├─ MI: ₱140
    │   └─ Agent: ₱120
    │
    ├─ Network Bonuses (from uplines inviting)
    │   ├─ MasterMD: ₱15 per invite
    │   ├─ MD: ₱10 per invite (1st only)
    │   ├─ MS: ₱20 per invite
    │   └─ MI: ₱20 per invite
    │
    ├─ Deposits
    │   ├─ User deposits via PayMongo
    │   ├─ Admin approves
    │   └─ eWallet += deposit amount
    │
    ├─ Capital Share Profits
    │   ├─ User invests ≥₱1,000
    │   ├─ Gets ₱60 monthly profit
    │   └─ eWallet += ₱60
    │
    └─ Payback Entry Rewards
        ├─ User makes payback entry ≥₱300
        ├─ Upline gets ₱65 reward (in 30 days)
        └─ User gets 2% of own payback as profit
```

---

## 4. DEPOSIT SYSTEM

### A. User Initiates Deposit

```
MEMBER DASHBOARD
    │
    ├─ Click "Deposit"
    │   ├─ DepositDialog opens
    │   ├─ Enter amount
    │   └─ Click "Pay Now"
    │       │
    │       ├─ Call: /api/create-payment-link
    │       │   ├─ Verify idToken
    │       │   ├─ Validate amount (> 0)
    │       │   └─ Create PayMongo checkout session
    │       │
    │       └─ Redirect to PayMongo checkout
    │           ├─ User enters card/GCash
    │           └─ Returns: checkout_url
```

### B. PayMongo Payment

```
PAYMONGO PAYMENT PAGE
    │
    ├─ User enters payment info
    │   └─ Payment processed
    │
    └─ PayMongo sends webhook to backend
        │
        ├─ /api/paymongo-webhook
        │   ├─ Verify webhook data
        │   └─ If success:
        │       ├─ Get paymentMetadata
        │       ├─ Create deposit record
        │       │   {
        │       │     userId: "user-uid",
        │       │     amount: 5000,
        │       │     status: "Pending",
        │       │     reference: "checkout_id",
        │       │     paymentMethod: "PayMongo"
        │       │   }
        │       └─ Update metadata.depositId
        │
        └─ DO NOT update eWallet yet!
            (Waiting for admin approval)
```

### C. Deposit Success Page

```
/deposit-success?sessionId=abc123
    │
    ├─ User lands on success page
    │
    ├─ Call: /api/verify-paymongo-payment
    │   ├─ Verify idToken
    │   ├─ Look up paymentMetadata[sessionId]
    │   │
    │   └─ Check deposit status:
    │       ├─ If webhook created it ✅
    │       │   └─ Return depositId
    │       │
    │       └─ If webhook missed it:
    │           ├─ CREATE FALLBACK deposit
    │           │   (client-side fallback)
    │           └─ Return depositId
    │
    └─ Show: "Deposit received! Awaiting admin approval"
```

### D. Admin Reviews & Approves

```
ADMIN DASHBOARD → /admin/deposits
    │
    ├─ Table shows:
    │   ├─ User name
    │   ├─ Amount
    │   ├─ Status (Pending/Approved/Rejected)
    │   └─ [Approve] [Reject] buttons
    │
    ├─ Click [Approve]
    │   │
    │   ├─ UPDATE deposits collection
    │   │   └─ status: "Approved"
    │   │
    │   └─ UPDATE users[uid].eWallet
    │       └─ eWallet += deposit amount ✅
    │
    └─ User sees balance updated!
```

---

## 5. WALLET-TO-WALLET TRANSFER

### A. Member Initiates Transfer

```
MEMBER DASHBOARD
    │
    ├─ Click "Transfer Funds"
    │   ├─ TransferFundsDialog opens
    │   ├─ Enter:
    │   │   ├─ Recipient username
    │   │   └─ Amount
    │   │
    │   └─ Click "Send"
    │       │
    │       └─ Call: /api/transfer-funds (backend)
    │           │
    │           ├─ Verify idToken
    │           ├─ Validate amount (min ₱50)
    │           │
    │           └─ RUN ATOMIC TRANSACTION:
    │               │
    │               ├─ Check sender wallet ≥ amount
    │               │   └─ If not → FAIL
    │               │
    │               ├─ Find recipient by username
    │               │   └─ If not found → FAIL
    │               │
    │               ├─ Calculate charges
    │               │   ├─ charge = amount * 2%
    │               │   └─ netAmount = amount - charge
    │               │
    │               ├─ UPDATE sender eWallet
    │               │   └─ eWallet -= amount
    │               │
    │               ├─ UPDATE recipient eWallet
    │               │   └─ eWallet += netAmount
    │               │
    │               ├─ CREATE transfer log
    │               │   {
    │               │     senderId: "uid",
    │               │     recipientId: "uid",
    │               │     amount: 1000,
    │               │     charge: 20,
    │               │     netAmount: 980,
    │               │     status: "Approved"
    │               │   }
    │               │
    │               └─ COMMIT all or ROLLBACK (atomic!)
    │
    └─ Success: Both wallets updated!
```

### B. Example

```
Sender: John (₱1000 balance)
Recipient: Jane

John sends ₱1000:
    ├─ Charge: ₱1000 × 2% = ₱20
    ├─ Net sent: ₱1000 - ₱20 = ₱980
    │
    ├─ John's wallet: ₱1000 - ₱1000 = ₱0 ✓
    └─ Jane's wallet: +₱980 ✓
```

---

## 6. REFERRAL REWARDS SYSTEM

### A. Reward Types

```
referralReward COLLECTION
    │
    ├─ DIRECT INVITE REWARD
    │   ├─ When: Member invites new user
    │   ├─ Amount: Based on member's role
    │   │   ├─ MasterMD: ₱235
    │   │   ├─ MD: ₱210
    │   │   ├─ MS: ₱160
    │   │   ├─ MI: ₱140
    │   │   └─ Agent: ₱120
    │   ├─ Approved: By admin when invite approved
    │   └─ Claimed: By member clicking "Claim Reward"
    │
    ├─ NETWORK BONUS
    │   ├─ When: Upline member invites
    │   ├─ Amount: Based on upline's role
    │   │   ├─ MasterMD: ₱15
    │   │   ├─ MD: ₱10 (first only)
    │   │   ├─ MS: ₱20
    │   │   └─ MI: ₱20
    │   ├─ Approved: By admin when invite approved
    │   └─ Claimed: By upline clicking "Claim Reward"
    │
    └─ SYSTEM BONUS
        ├─ When: Invite approved
        ├─ Who gets:
        │   ├─ Master MD: ₱100
        │   ├─ Special emails: ₱50-₱100
        │   └─ (Admin account)
        ├─ Approved: Automatically (admin-created)
        └─ Claimed: Usually auto-transferred
```

### B. Claim Reward Flow

```
MEMBER DASHBOARD → Rewards Tab
    │
    ├─ Shows pending/approved rewards
    │   ├─ Direct Invite Reward: ₱210
    │   ├─ Status: Approved
    │   └─ [Claim Reward] button
    │
    └─ Click [Claim Reward]
        │
        ├─ Call: /api/transfer-referral-reward (backend)
        │   │
        │   ├─ Verify idToken
        │   ├─ Get reward record
        │   │
        │   ├─ Check if already transferred
        │   │   └─ If yes → FAIL
        │   │
        │   ├─ RUN ATOMIC TRANSACTION:
        │   │   ├─ UPDATE user.eWallet
        │   │   │   └─ eWallet += reward.amount
        │   │   │
        │   │   ├─ UPDATE referralReward
        │   │   │   ├─ payoutReleased: true
        │   │   │   └─ dateTransferred: now
        │   │   │
        │   │   ├─ CREATE referralRewardTransferlogs
        │   │   │   {
        │   │   │     userId: "uid",
        │   │   │     amount: 210,
        │   │   │     status: "Transferred",
        │   │   │     createdAt: now
        │   │   │   }
        │   │   │
        │   │   └─ CREATE deposit record
        │   │       {
        │   │         userId: "uid",
        │   │         amount: 210,
        │   │         type: "Direct Invite Reward",
        │   │         status: "Approved"
        │   │       }
        │   │
        │   └─ COMMIT all or ROLLBACK
        │
        └─ Success: Reward transferred to eWallet! ✅
```

---

## 7. CAPITAL SHARE INVESTMENT

### A. User Creates Capital Share Entry

```
MEMBER DASHBOARD → Capital Share
    │
    ├─ Click "Add Capital Share"
    │   ├─ Enter amount (min ₱1,000)
    │   └─ Click "Submit"
    │       │
    │       ├─ Call: /api/add-capital-share (backend)
    │       │   │
    │       │   ├─ Verify idToken
    │       │   ├─ Validate amount (≥₱1,000)
    │       │   │
    │       │   ├─ RUN ATOMIC TRANSACTION:
    │       │   │   ├─ Check user.eWallet ≥ amount
    │       │   │   │   └─ If not → FAIL
    │       │   │   │
    │       │   │   ├─ Calculate lock-in portion
    │       │   │   │   ├─ Total required lock-in: ₱5,000
    │       │   │   │   ├─ If existing lock-in < ₱5,000:
    │       │   │   │   │   └─ Lock first part of new entry
    │       │   │   │   └─ Remaining is transferable
    │       │   │   │
    │       │   │   ├─ UPDATE user.eWallet
    │       │   │   │   └─ eWallet -= amount
    │       │   │   │
    │       │   │   ├─ CREATE capitalShareEntries
    │       │   │   │   {
    │       │   │   │     userId: "uid",
    │       │   │   │     amount: 1000,
    │       │   │   │     lockInPortion: 1000,    // 0-5000
    │       │   │   │     transferablePortion: 0,  // Above 5000
    │       │   │   │     profit: 0,
    │       │   │   │     profitStatus: "Pending",
    │       │   │   │     status: "Approved",
    │       │   │   │     transferableAfterDate: now + 1 month
    │       │   │   │   }
    │       │   │   │
    │       │   │   ├─ CREATE upline bonus (5% of amount)
    │       │   │   │   └─ If referredBy exists:
    │       │   │   │       └─ override collection
    │       │   │   │           {
    │       │   │   │             uplineId: "uid",
    │       │   │   │             fromUserId: "uid",
    │       │   │   │             amount: 50,  // 1000 × 5%
    │       │   │   │             status: "Pending",
    │       │   │   │             releaseDate: now + 1 month
    │       │   │   │           }
    │       │   │   │
    │       │   │   └─ COMMIT or ROLLBACK
    │       │   │
    │       │   └─ Return: entryId, newBalance
    │       │
    │       └─ Success: Entry created! Monthly profit generation starts
```

### B. Monthly Profit (Automated)

```
[ADMIN SYSTEM - MONTHLY CRON JOB]
    │
    ├─ For each capitalShareEntries:
    │   ├─ If profitStatus == "Pending":
    │   │   ├─ Calculate profit: amount × 6% / 12 = ₱60/month
    │   │   ├─ UPDATE entry.profit += ₱60
    │   │   └─ Set nextProfitDate to next month
    │   │
    │   └─ If transferred:
    │       └─ STOP profit generation (profitEnabled = false)
```

### C. User Claims Profit

```
MEMBER DASHBOARD → Capital Share
    │
    ├─ Shows entry with:
    │   ├─ Amount: ₱1,000
    │   ├─ Monthly Profit: ₱60
    │   └─ [Claim Profit] button
    │
    └─ Click [Claim Profit]
        │
        ├─ Call: /api/transfer-profit (backend)
        │   │
        │   ├─ Verify idToken
        │   ├─ Get entry
        │   │
        │   ├─ Check profit > 0 and not claimed
        │   │
        │   └─ RUN ATOMIC TRANSACTION:
        │       ├─ UPDATE user.eWallet
        │       │   └─ eWallet += profit
        │       │
        │       ├─ UPDATE capitalShareEntries
        │       │   ├─ profitStatus: "Claimed"
        │       │   └─ profitClaimedAt: now
        │       │
        │       └─ CREATE deposit record
        │           {
        │             userId: "uid",
        │             amount: 60,
        │             type: "Monthly Profit Transfer",
        │             status: "Approved"
        │           }
        │
        └─ Success: Profit claimed! ✅
```

### D. User Transfers Capital Share (After 1 month)

```
MEMBER DASHBOARD → Capital Share
    │
    ├─ Entry locked for 1 month
    ├─ After 1 month:
    │   ├─ [Transfer Capital Share] button enabled
    │   └─ Can transfer the excess over ₱5,000
    │
    └─ Click [Transfer Capital Share]
        │
        ├─ Call: /api/transfer-capital-share (backend)
        │   │
        │   ├─ Verify idToken
        │   ├─ Check transferableAfterDate passed
        │   │
        │   └─ RUN ATOMIC TRANSACTION:
        │       ├─ UPDATE user.eWallet
        │       │   └─ eWallet += transferablePortion
        │       │
        │       ├─ UPDATE entry
        │       │   ├─ transferredAmount: transferred
        │       │   ├─ profitEnabled: false ✓
        │       │   └─ profitStatus: "Stopped"
        │       │
        │       └─ CREATE deposit record
        │           {
        │             userId: "uid",
        │             amount: amount,
        │             type: "Capital Share Transfer",
        │             status: "Approved"
        │           }
        │
        └─ Success: Capital transferred! Profit generation STOPS ✓
```

---

## 8. PAYBACK ENTRIES & UPLINE REWARDS

### A. User Creates Payback Entry

```
MEMBER DASHBOARD → Payback Entry
    │
    ├─ Click "Add Payback Entry"
    │   ├─ Enter amount (min ₱300)
    │   ├─ Select upline
    │   └─ Click "Submit"
    │       │
    │       ├─ Call: /api/add-payback-entry (backend)
    │       │   │
    │       │   ├─ Verify idToken
    │       │   ├─ Validate amount (≥₱300)
    │       │   │
    │       │   ├─ RUN ATOMIC TRANSACTION:
    │       │   │   ├─ Check user.eWallet ≥ amount
    │       │   │   │
    │       │   │   ├─ Find upline by username
    │       │   │   │
    │       │   │   ├─ UPDATE user.eWallet
    │       │   │   │   └─ eWallet -= amount
    │       │   │   │
    │       │   │   ├─ CREATE paybackEntries
    │       │   │   │   {
    │       │   │   │     userId: "uid",
    │       │   │   │     uplineUsername: "upline",
    │       │   │   │     amount: 500,
    │       │   │   │     date: now,
    │       │   │   │     expirationDate: now + 30 days,
    │       │   │   │     rewardGiven: false
    │       │   │   │   }
    │       │   │   │
    │       │   │   ├─ CREATE uplineRewards
    │       │   │   │   {
    │       │   │   │     uplineId: "uid",
    │       │   │   │     uplineUsername: "upline",
    │       │   │   │     fromUserId: "uid",
    │       │   │   │     amount: 65,          // Upline gets ₱65
    │       │   │   │     status: "Pending",
    │       │   │   │     dueDate: now + 30 days,
    │       │   │   │     claimed: false
    │       │   │   │   }
    │       │   │   │
    │       │   │   └─ CREATE transaction log
    │       │   │       {
    │       │   │         userId: "uid",
    │       │   │         amount: 500,
    │       │   │         uplineRewardAmount: 65,
    │       │   │         status: "Success"
    │       │   │       }
    │       │   │
    │       │   └─ Return: entryId, newBalance, uplineReward info
    │       │
    │       └─ Success: Entry created!
    │           └─ Upline will get ₱65 reward in 30 days ✓
```

### B. Upline Claims Override Reward (After 30 days)

```
UPLINE DASHBOARD → Rewards
    │
    ├─ Shows pending uplineRewards
    │   ├─ From: downline username
    │   ├─ Amount: ₱65
    │   ├─ Due: when 30 days pass
    │   └─ [Claim Reward] button
    │
    └─ Click [Claim Reward] (after 30 days)
        │
        ├─ Call: /api/transfer-override-reward (backend)
        │   │
        │   ├─ Verify idToken
        │   ├─ Get uplineRewards record
        │   │
        │   ├─ Check if dueDate has passed
        │   │   └─ If not → FAIL with message
        │   │
        │   ├─ Check if not already claimed
        │   │
        │   └─ RUN ATOMIC TRANSACTION:
        │       ├─ UPDATE user.eWallet
        │       │   └─ eWallet += ₱65
        │       │
        │       ├─ UPDATE uplineRewards
        │       │   ├─ claimed: true
        │       │   ├─ claimedAt: now
        │       │   └─ status: "Credited"
        │       │
        │       └─ CREATE overrideTransactions
        │           {
        │             userId: "uid",
        │             amount: 65,
        │             status: "Credited",
        │             createdAt: now
        │           }
        │
        └─ Success: Reward claimed! ✓
```

---

## 9. ADMIN DASHBOARD OVERVIEW

```
ADMIN DASHBOARD (/admin/dashboard)
    │
    ├─ STATISTICS CARDS
    │   ├─ Total Users
    │   ├─ Total Deposits
    │   ├─ Total Transfers
    │   └─ Top Referrers
    │
    ├─ PENDING INVITES
    │   ├─ Table with pending invites
    │   ├─ [Approve] [Reject] buttons
    │   └─ Triggers user account creation
    │
    ├─ PENDING DEPOSITS
    │   ├─ Table with deposits awaiting approval
    │   ├─ Shows amount and user
    │   ├─ [Approve] [Reject] buttons
    │   └─ Updates user eWallet on approve
    │
    ├─ PAYBACK ENTRIES
    │   ├─ Table with all payback entries
    │   ├─ Shows user, upline, amount
    │   └─ Upline rewards auto-created
    │
    ├─ WALLET TRANSFERS
    │   ├─ History of all wallet-to-wallet transfers
    │   ├─ Shows sender, recipient, amount
    │   └─ Includes 2% charge details
    │
    ├─ REFERRAL REWARDS
    │   ├─ All referral rewards (direct + network)
    │   ├─ Filter by approved/claimed
    │   └─ Edit/approve as needed
    │
    └─ CAPITAL SHARES
        ├─ All capital share entries
        ├─ Shows profit calculations
        └─ Monitor monthly distributions
```

---

## 10. SECURITY & VALIDATION

### A. Authentication

```
✅ All endpoints require idToken
✅ Firebase Admin SDK verifies token
✅ User UID extracted from token
✅ Firestore rules enforce row-level access
```

### B. Atomic Transactions

```
✅ All money operations use db.runTransaction()
✅ All writes succeed or fail together
✅ No partial state (never lose money)
✅ Automatic rollback on error
```

### C. Role-Based Access

```
ADMIN/CEO:
    ├─ Can view all data
    ├─ Can approve/reject invites
    ├─ Can approve/reject deposits
    └─ Can manage users

MEMBER (MD/MS/MI):
    ├─ Can create invites
    ├─ Can transfer funds
    ├─ Can invest in capital share
    ├─ Can view own rewards
    └─ Can claim rewards

MERCHANT:
    ├─ Can manage products
    ├─ Can view sales
    └─ Can manage inventory
```

### D. Firestore Rules

```
✅ Users can only read own documents
✅ Users can only update own profile fields
✅ Admin can read/write everything
✅ Server-side writes (Admin SDK) bypass auth
✅ Collections are properly scoped
```

---

## 11. DATA FLOW DIAGRAM

```
NEW USER REGISTRATION
═══════════════════════════════════════════════════════════════════════

Member invites user
        │
        v
pendingInvites doc created
        │
        v
referralReward doc created (not approved yet)
        │
        v
Admin approves invite
        │
        ├─ Firebase Auth user created
        │
        ├─ users[uid] doc created
        │   ├─ username, email, role
        │   ├─ referredBy: inviter username
        │   └─ eWallet: 0
        │
        ├─ referralReward updated
        │   └─ approved: true, payoutReleased: true
        │
        └─ pendingInvites deleted


MEMBER EARNING FLOW
═══════════════════════════════════════════════════════════════════════

Member takes action (invite, transfer, payback)
        │
        v
Backend validates and processes
        │
        v
Firestore atomic transaction
        │
        ├─ Update relevant collections
        ├─ Create logs/records
        └─ Rollback on any error
        │
        v
Member sees updated balance
        │
        v
Admin can see transaction history


SECURITY LAYER
═══════════════════════════════════════════════════════════════════════

Request → Firebase Auth verification
        │
        v
Extract UID from ID token
        │
        v
Database operation
        │
        ├─ Server-side validation
        ├─ Check user role/permissions
        ├─ Check account existence
        └─ Check sufficient balance
        │
        v
Firestore security rules
        │
        ├─ Row-level access control
        ├─ Field-level restrictions
        └─ Admin SDK bypass
        │
        v
Response with updated data
```

---

## 12. Key Collections Structure

```
FIRESTORE COLLECTIONS
═════════════════════════════════════════════════════════════════════

├─ users/
│   ├─ uid: string (document ID)
│   ├─ username: string
│   ├─ email: string
│   ├─ role: string (ADMIN, CEO, MD, MS, MI, Agent, MERCHANT)
│   ├─ eWallet: number
│   ├─ referredBy: string (inviter username)
│   ├─ referrerRole: string
│   ├─ capitalShareActive: boolean
│   ├─ createdAt: timestamp
│   └─ ... other profile fields
│
├─ pendingInvites/
│   ├─ inviterId: string
│   ├─ inviterUsername: string
│   ├─ inviteeUsername: string
│   ├─ inviteeEmail: string
│   ├─ role: string
│   ├─ code: string
│   └─ status: string (Pending Approval, Approved, Rejected)
│
├─ referralReward/
│   ├─ userId: string
│   ├─ username: string
│   ├─ amount: number
│   ├─ source: string (invitee username or system)
│   ├─ type: string (Direct Invite Reward, Network Bonus, System Bonus)
│   ├─ approved: boolean
│   ├─ payoutReleased: boolean
│   ├─ dateTransferred: timestamp
│   └─ createdAt: timestamp
│
├─ deposits/
│   ├─ userId: string
│   ├─ amount: number
│   ├─ status: string (Pending, Approved, Rejected)
│   ├─ reference: string (checkout_id)
│   ├─ paymentMethod: string (PayMongo)
│   └─ createdAt: timestamp
│
├─ transferFunds/
│   ├─ senderId: string
│   ├─ recipientId: string
│   ├─ amount: number
│   ├─ charge: number (2%)
│   ├─ netAmount: number
│   ├─ status: string (Approved)
│   └─ createdAt: timestamp
│
├─ capitalShareEntries/
│   ├─ userId: string
│   ├─ amount: number
│   ├─ lockInPortion: number
│   ├─ transferablePortion: number
│   ├─ profit: number
│   ├─ profitStatus: string (Pending, Claimed, Stopped)
│   ├─ status: string (Approved)
│   ├─ transferableAfterDate: timestamp
│   └─ createdAt: timestamp
│
├─ paybackEntries/
│   ├─ userId: string
│   ├─ uplineUsername: string
│   ├─ amount: number
│   ├─ expirationDate: timestamp (30 days)
│   ├─ rewardGiven: boolean
│   └─ createdAt: timestamp
│
└─ uplineRewards/
    ├─ uplineId: string
    ├─ uplineUsername: string
    ├─ fromUserId: string
    ├─ paybackEntryId: string
    ├─ amount: number (₱65)
    ├─ status: string (Pending, Credited)
    ├─ dueDate: timestamp
    ├─ claimed: boolean
    └─ createdAt: timestamp
```

---

## 13. Backend API Endpoints

```
POST /api/transfer-funds
    ├─ Parameters: idToken, recipientUsername, amount
    ├─ Validation: amount ≥ ₱50
    ├─ Charge: 2% of amount
    └─ Returns: newBalance, transferId

POST /api/add-capital-share
    ├─ Parameters: idToken, amount, entryDate
    ├─ Validation: amount ≥ ₱1,000
    ├─ Lock-in: First ₱5,000 total
    └─ Returns: entryId, newBalance

POST /api/add-payback-entry
    ├─ Parameters: idToken, uplineUsername, amount
    ├─ Validation: amount ≥ ₱300
    ├─ Upline reward: ₱65 (after 30 days)
    └─ Returns: entryId, newBalance

POST /api/transfer-profit
    ├─ Parameters: idToken, entryId, amount
    ├─ Profit per entry: ₱60/month
    └─ Returns: newBalance, transferId

POST /api/transfer-capital-share
    ├─ Parameters: idToken, entryId, amount
    ├─ Wait period: 1 month
    └─ Returns: newBalance, transferId

POST /api/transfer-referral-reward
    ├─ Parameters: idToken, rewardId, amount
    ├─ Checks: Reward not already transferred
    └─ Returns: newBalance, depositId

POST /api/create-payment-link
    ├─ Parameters: idToken, amount, name, email
    ├─ Provider: PayMongo
    └─ Returns: checkoutUrl, checkoutId

POST /api/paymongo-webhook
    ├─ Triggered by: PayMongo payment success
    ├─ Creates: Deposit record (Pending status)
    └─ NO eWallet update (admin approval needed)

POST /api/verify-paymongo-payment
    ├─ Parameters: idToken, sessionId
    ├─ Fallback: Creates deposit if webhook failed
    └─ Returns: depositId
```

---

## 14. System Features Summary

```
✅ INVITE SYSTEM
   ├─ Members invite new users
   ├─ Admin approval required
   ├─ Direct rewards + network bonuses
   └─ System bonuses for key players

✅ AUTHENTICATION
   ├─ Email/password login
   ├─ Firebase Auth
   ├─ Role-based access control
   └─ Session management

✅ WALLET SYSTEM
   ├─ eWallet balance tracking
   ├─ Multiple earning sources
   ├─ Balance updates on all transactions
   └─ Withdrawal support

✅ TRANSFERS
   ├─ Wallet-to-wallet (2% charge)
   ├─ Atomic transactions
   ├─ Transaction logs
   └─ Both parties updated simultaneously

✅ DEPOSITS
   ├─ PayMongo integration
   ├─ Webhook + client-side fallback
   ├─ Admin approval workflow
   └─ Offline resilience

✅ REFERRAL REWARDS
   ├─ Direct invite bonuses
   ├─ Network chain bonuses
   ├─ Multi-level system
   └─ Claim mechanism

✅ CAPITAL SHARES
   ├─ Min ₱1,000 investment
   ├─ Lock-in period (₱5,000 total)
   ├─ Monthly profit (6% annually)
   ├─ 1-month transfer period
   └─ Profit stops on transfer

✅ PAYBACK ENTRIES
   ├─ Min ₱300 entries
   ├─ Upline gets ₱65 after 30 days
   ├─ Automatic override creation
   └─ Time-locked rewards

✅ ADMIN PANEL
   ├─ User management
   ├─ Invite approvals
   ├─ Deposit approvals
   ├─ Dashboard statistics
   └─ Comprehensive logs
```

---

**Last Updated**: January 13, 2026
**System Status**: ✅ Fully Operational
