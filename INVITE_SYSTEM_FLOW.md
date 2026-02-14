# Invite System - Complete Flow

## Overview

The invite system allows existing members to invite new users into the network and earn referral rewards based on the invitee's role.

---

## Step-by-Step Flow

### Phase 1: Member Creates Invite

**Where**: Member Dashboard → Click "Invite & Earn"  
**Component**: `src/components/Topbar/dialogs/InviteEarnDialog.jsx`

#### 1. Member Fills Invite Form
```
Form Fields:
├─ New User Name
├─ New User Username
├─ New User Email
├─ New User Contact
├─ New User Address
├─ New User Role (MD, MS, MI, Agent)
└─ Select Activation Code (from available codes)
```

**Validations**:
- ✅ All fields required
- ✅ Email must be valid format (no spaces)
- ✅ Email must not already exist in system
- ✅ Activation code must be selected (unused code)

#### 2. Member Submits Invite
When member clicks "Send Invite", the system does:

```
Step 1: Create Pending Invite Record
└─ Collection: pendingInvites
   {
     inviterId: "member-uid",
     inviterUsername: "john",
     inviterRole: "MD",
     inviteeName: "Jane Doe",
     inviteeUsername: "jane",
     inviteeEmail: "jane@email.com",
     contactNumber: "09123456789",
     address: "Manila",
     role: "MS",           // Invitee role
     code: "ABC123",       // Activation code
     referralCode: "john",
     referredBy: "john",
     referrerRole: "MD",
     status: "Pending Approval",
     createdAt: now
   }

Step 2: Mark Activation Code as Used
└─ Collection: purchaseCodes
   └─ Set: used = true

Step 3: Create Direct Invite Reward for Member
└─ Collection: referralReward
   {
     userId: "member-uid",
     username: "john",
     role: "MD",
     amount: 210,          // Based on their role
     source: "jane",       // Invitee username
     type: "Direct Invite Reward",
     approved: false,      // Admin approval needed
     payoutReleased: false,
     createdAt: now
   }

Step 4: Create Network Bonuses (up the chain)
└─ For each upline member up to CEO:
   └─ Check upline role and add bonus:
      ├─ MasterMD: ₱15
      ├─ MD (only first): ₱10
      ├─ MS: ₱20
      └─ MI: ₱20

Step 5: Special System Bonuses
├─ Master MD gets: ₱100 (for every invite)
└─ Special emails get:
   ├─ eliskie40@gmail.com: ₱100
   └─ Monares.cyriljay@gmail.com: ₱50
```

**Direct Invite Reward Map** (By Member Role):
```
MasterMD → ₱235
MD       → ₱210
MS       → ₱160
MI       → ₱140
Agent    → ₱120
```

#### 3. System Shows Success Message
```
"Invite sent successfully!
Jane Doe (jane) has been invited.
You'll earn rewards once admin approves."
```

---

### Phase 2: Admin Reviews & Approves Invite

**Where**: Admin Dashboard → Users → Pending Invites  
**Component**: `src/pages/admin/adminUserManagement.jsx`

#### 1. Admin Views Pending Invites
```
Table Shows:
├─ Invitee Name
├─ Invitee Email
├─ Invitee Role
├─ Inviter Name
├─ Status: "Pending Approval"
└─ Action Buttons: [Approve] [Reject]
```

#### 2. Admin Clicks "Approve"

System performs these actions:

```
Action 1: Create Firebase Auth User
└─ Email: inviteeEmail
└─ Password: "password123" (initial)
└─ Returns: uid

Action 2: Create User in Firestore
└─ Collection: users
   {
     uid: "generated-uid",
     username: "jane",
     name: "Jane Doe",
     email: "jane@email.com",
     contactNumber: "09123456789",
     address: "Manila",
     role: "MS",
     referredBy: "john",        // Inviter username
     referrerRole: "MD",        // Inviter role
     referralReward: false,
     eWallet: 0,
     createdAt: now
   }

Action 3: Create/Update Direct Invite Reward
└─ Mark as approved for member
└─ Create reward record if not exist

Action 4: Process Network Bonuses
├─ Walk up the referral chain
├─ Skip CEO (stops chain there)
├─ Apply bonuses by role:
│  ├─ MasterMD: ₱15
│  ├─ First MD only: ₱10
│  ├─ MS: ₱20
│  └─ MI: ₱20
└─ Create referralReward records

Action 5: Delete Pending Invite
└─ Remove from pendingInvites collection
```

#### 3. Admin Rejects Invite (Alternative)

```
If Admin clicks "Reject":
├─ Delete: pendingInvites record
├─ Revert: purchaseCodes.used = false
├─ Delete: referralReward records for this invite
└─ No user account created
```

---

## Complete System Flow Diagram

```
INVITE FLOW - COMPLETE
═════════════════════════════════════════════════════════════

MEMBER SIDE (Frontend - InviteEarnDialog.jsx)
───────────────────────────────────────────────

Member logs in
    │
    ├─ Click "Invite & Earn" button
    │
    ├─ Form appears with fields:
    │  ├─ Invitee Name
    │  ├─ Username
    │  ├─ Email
    │  ├─ Contact
    │  ├─ Address
    │  ├─ Role dropdown
    │  └─ Activation Code dropdown (auto-populated with unused codes)
    │
    ├─ Validations:
    │  ├─ All fields required ✓
    │  ├─ Email valid format ✓
    │  ├─ Email not in use ✓
    │  └─ Code selected ✓
    │
    ├─ Click "Send Invite"
    │
    └─ FIRESTORE WRITES (Atomic Transaction):
       │
       ├─ 1️⃣ INSERT pendingInvites
       │   └─ Status: "Pending Approval"
       │
       ├─ 2️⃣ UPDATE purchaseCodes
       │   └─ used: true
       │
       ├─ 3️⃣ INSERT referralReward (Direct)
       │   └─ Amount: Based on member role
       │       ├─ MasterMD: ₱235
       │       ├─ MD: ₱210
       │       ├─ MS: ₱160
       │       ├─ MI: ₱140
       │       └─ Agent: ₱120
       │
       ├─ 4️⃣ INSERT referralReward (Network Bonuses)
       │   └─ For each upline:
       │       ├─ MasterMD: ₱15
       │       ├─ MD (first only): ₱10
       │       ├─ MS: ₱20
       │       └─ MI: ₱20
       │
       └─ 5️⃣ INSERT referralReward (System Bonuses)
           └─ Master MD: ₱200
            └─ Special emails:
              ├─ eliskie40@gmail.com: ₱100
              └─ Monares.cyriljay@gmail.com: ₱50


ADMIN SIDE (Backend - adminUserManagement.jsx)
──────────────────────────────────────────────

Admin sees "Pending Invites" in dashboard
    │
    ├─ Table shows pending invites
    │
    ├─ Admin clicks "Approve" button
    │
    └─ FIREBASE AUTH + FIRESTORE WRITES:
       │
       ├─ 1️⃣ CREATE Firebase Auth User
       │   ├─ Email: inviteeEmail
       │   ├─ Password: "password123"
       │   └─ Returns: uid
       │
       ├─ 2️⃣ INSERT users collection
       │   ├─ uid: generated-uid
       │   ├─ username: inviteeUsername
       │   ├─ email: inviteeEmail
       │   ├─ role: inviteeRole
       │   ├─ referredBy: inviterUsername
       │   └─ referrerRole: inviterRole
       │
       ├─ 3️⃣ UPDATE referralReward
       │   └─ Mark existing rewards as approved
       │
       ├─ 4️⃣ DELETE pendingInvites
       │   └─ Remove from pending queue
       │
       └─ ✅ SUCCESS
           └─ New user account created
           └─ All referral rewards set up
           └─ Ready to login


NEW USER SIDE (After Account Created)
─────────────────────────────────────

New user receives email:
    └─ Email: inviteeEmail
    └─ Password: "password123" (initial)

New user can:
    ├─ Login with email + password
    ├─ Access dashboard with their role
    ├─ See referrer information
    └─ View earned rewards when admin approves


REWARD DISTRIBUTION TIMELINE
────────────────────────────

When Invite Created (Step 3-5):
    └─ referralReward records created
    └─ approved: false (pending admin approval)
    └─ payoutReleased: false

When Admin Approves:
    └─ approved: true
    └─ Now visible in member's "Rewards" dashboard

When Member Claims Reward:
    └─ payoutReleased: true
    └─ Transferred to eWallet
    └─ Can be withdrawn or used
```

---

## Data Structures

### 1. pendingInvites Collection
```javascript
{
  id: "auto-generated",
  inviterId: "uid-of-member",
  inviterUsername: "john",
  inviterRole: "MD",
  inviteeName: "Jane Doe",
  inviteeUsername: "jane",
  inviteeEmail: "jane@email.com",
  contactNumber: "09123456789",
  address: "Manila",
  role: "MS",                    // Role of new user
  code: "ABC123",                // Activation code used
  referralCode: "john",
  referredBy: "john",
  referrerRole: "MD",
  status: "Pending Approval",    // or "Approved" / "Rejected"
  createdAt: Timestamp
}
```

### 2. referralReward Collection
```javascript
{
  id: "auto-generated",
  userId: "uid-of-reward-recipient",
  username: "john",
  role: "MD",
  amount: 210,                   // Amount in PHP
  source: "jane",                // Who generated this reward
  type: "Direct Invite Reward",  // or "Network Bonus" / "System Bonus"
  approved: false,               // Admin approval needed
  payoutReleased: false,         // Transferred to eWallet?
  createdAt: Timestamp,
  dateTransferred: Timestamp     // When transferred to eWallet
}
```

### 3. users Collection (New User)
```javascript
{
  uid: "generated-by-firebase",
  username: "jane",
  name: "Jane Doe",
  email: "jane@email.com",
  contactNumber: "09123456789",
  address: "Manila",
  role: "MS",
  referredBy: "john",            // Referrer username
  referrerRole: "MD",            // Referrer role
  referralReward: false,
  eWallet: 0,
  createdAt: Timestamp
}
```

---

## Bonus Structure

### Direct Invite Rewards (By Member Role)
```
When a member invites someone, member gets:

MasterMD → ₱235
MD       → ₱210
MS       → ₱160
MI       → ₱140
Agent    → ₱120
```

### Network Bonuses (Up the Referral Chain)
```
For each upline member above the inviter:

Role        Amount    Max
──────────────────────────
MasterMD    ₱15       Unlimited
MD          ₱10       1 only (first)
MS          ₱20       Unlimited
MI          ₱20       Unlimited
CEO         (Stops)   Chain ends here
```

### System Special Bonuses
```
For Invite:
  Master MD:                   ₱100 per every invite
  Special emails:
    - eliskie40@gmail.com:     ₱100 per invite
    - Monares.cyriljay@gmail.com: ₱50 per invite

For Capital Share Entry:
  Master MD:                   ₱100 per entry
  Special emails:
    - eliskie40@gmail.com:     ₱100 per entry
    - gedeongipulankjv1611@gmail.com: ₱100 per entry
    - Monares.cyriljay@gmail.com: ₱50 per entry
```

---

## Security & Validation

### During Invite Creation
✅ Email must be valid (regex check)  
✅ Email must not already exist  
✅ Activation code must be unused  
✅ All fields must be filled  
✅ Member must be authenticated  

### During Admin Approval
✅ Admin must be ADMIN or CEO role  
✅ Inviter must exist in system  
✅ Email must not be duplicated  
✅ Firebase Auth user creation must succeed  
✅ Firestore writes in transaction  

### Firestore Security Rules
```
pendingInvites:
  - Admin/CEO can read all
  - Members can read only their own invites

referralReward:
  - User can read their own rewards
  - Admin can read all
  - Admin can approve/reject
```

---

## Key Features

✅ **Activation Code Required**: Every invite uses a purchase code (prevents unlimited signups)  
✅ **Multi-level Bonuses**: Network chain rewards up to CEO  
✅ **Role-based Rewards**: Different bonuses for different roles  
✅ **Admin Approval**: All invites require admin approval before account created  
✅ **Atomic Transactions**: All reward records created together (no partial state)  
✅ **Special Bonuses**: System and email-based bonuses for key players  

---

## Example Scenario

**Member**: John (MD)  
**Invites**: Jane (MS)

**What Happens**:
```
1. John fills form:
   - Name: Jane Doe
   - Username: jane
   - Email: jane@email.com
   - Role: MS
   - Code: ABC123 (unused)

2. System creates:
   ✅ Pending invite for admin approval
   ✅ John gets ₱210 (MD direct reward)
   ✅ John's upline (if MS) gets ₱20 (network bonus)
   ✅ John's upline's upline gets bonuses per their role
   ✅ Master MD gets ₱100 (system bonus)
   ✅ Special emails check for: eliskie40@gmail.com (₱100), Monares.cyriljay@gmail.com (₱50)

3. Admin approves:
   ✅ Jane's Firebase account created
   ✅ Jane's user profile created
   ✅ Jane can now login
   ✅ Referral chain set up

4. John claims reward:
   ✅ ₱210 transferred to John's eWallet
   ✅ Can withdraw or use for purchases
```

---

## Testing Checklist

- [ ] Member can create invite with all fields
- [ ] Email validation works (rejects invalid format)
- [ ] Email duplication check works
- [ ] Unused codes appear in dropdown
- [ ] Used codes disappear from dropdown
- [ ] Pending invite appears in admin dashboard
- [ ] Admin can approve invite
- [ ] New user account created successfully
- [ ] New user can login with email + password
- [ ] Referral rewards created for all uplines
- [ ] Admin can see rewards in referral dashboard
- [ ] Member can claim and transfer rewards
- [ ] Admin can reject invite
- [ ] Rejected invite deletes all records

---

**Last Updated**: January 13, 2026
