# Transfer Funds Backend Setup

## Prerequisites
- Node.js installed
- Firebase project with Admin SDK access

## Setup Instructions

### 1. Get Firebase Admin SDK Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ > **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file

### 2. Configure Backend Environment Variables

1. Open `backend/.env`
2. Fill in the values from your downloaded JSON file:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
PORT=5000
```

**Important:** Keep the quotes around `FIREBASE_PRIVATE_KEY` and ensure `\n` characters are preserved.

### 3. Update Firestore Security Rules

1. Deploy the new Firestore rules:
```bash
firebase deploy --only firestore:rules
```

Or manually copy the rules from `firestore.rules` to your Firebase Console:
- Go to Firestore Database > Rules
- Replace with the new rules
- Click **Publish**

### 4. Start the Backend Server

```bash
cd backend
node server.js
```

The server will run on `http://localhost:5000`

### 5. Update Frontend API URL (Production)

When deploying to production, update the API URL in:
`src/components/Topbar/dialogs/TransferFundsDialog.jsx`

Change:
```javascript
const response = await fetch("http://localhost:5000/api/transfer-funds", {
```

To your production backend URL:
```javascript
const response = await fetch("https://your-backend-url.com/api/transfer-funds", {
```

## How It Works

1. **User initiates transfer** from the frontend
2. **Frontend gets ID token** from Firebase Auth
3. **Backend verifies token** and user authentication
4. **Backend runs atomic transaction**:
   - Verifies sender has sufficient balance
   - Verifies recipient exists
   - Debits sender's eWallet
   - Credits recipient's eWallet (minus 2% charge)
   - Creates transfer log with "Approved" status
5. **Frontend receives response** and updates UI

## Security Features

✅ **Atomic transactions** - All operations succeed or fail together (no partial transfers)
✅ **Server-side validation** - Balance checks happen on trusted server
✅ **Duplicate prevention** - Transaction rollback on any error
✅ **Authentication required** - ID token verification
✅ **Firestore rules** - Admin SDK bypass for server operations

## Testing

1. Start backend: `cd backend && node server.js`
2. Start frontend: `npm start` (in root directory)
3. Login with `sample@gmail.com`
4. Try sending money to another user
5. Check both users' eWallet balances update correctly
6. Check `/admin/wallet-to-wallet` for transfer logs

## Troubleshooting

**Error: "Missing or insufficient permissions"**
- Make sure Firestore rules are deployed
- Check that `request.auth == null` allows server writes

**Error: "Unauthorized"**
- Verify backend .env credentials are correct
- Check Firebase Admin SDK setup

**Error: "Recipient not found"**
- Ensure username is typed correctly (case-sensitive)
- User must exist in Firestore `users` collection
