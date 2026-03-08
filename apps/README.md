# Multi-App Setup (Single Firebase Project)

This repository now includes 3 separate frontend apps that share the same Firebase project and Firestore database:

- `apps/user-app` (port 3001)
- `apps/merchant-app` (port 3002)
- `apps/rider-app` (port 3003)

All apps import Firebase setup from:

- `shared/firebase/firebaseClient.js`

## Environment Variables

Use the same Firebase values for all apps. In each app folder, create a `.env` file with:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_SECONDARY_API_KEY=... # optional
```

`REACT_APP_*` names are also supported by the shared module for backward compatibility.

## Install

Run once per app:

```bash
npm install --prefix apps/user-app
npm install --prefix apps/merchant-app
npm install --prefix apps/rider-app
```

## Run

From the repository root:

```bash
npm run dev:user
npm run dev:merchant
npm run dev:rider
```

## Data Model (Shared)

All apps read/write the same Firestore collections, so role-based security must stay in Firestore rules.

Recommended use:

- User App: browse merchants, create orders
- Merchant App: accept orders, manage menu
- Rider App: accept delivery jobs

## User App Routing Pattern

`apps/user-app` now uses a split flow:

- `/dashboard`: member overview + shop preview card only
- `/shop`: dedicated merchant browsing/order creation entry
- `/orders`: dedicated order tracking view
- `/cart`: dedicated checkout flow

This keeps the dashboard lightweight while shop/order tasks stay in focused pages.
