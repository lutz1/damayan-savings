# Copilot Instructions for amayan-savings

## Project Overview
- **Frontend:** React (Create React App), Material-UI, Firebase JS SDK, PWA support
- **Backend:** Node.js (Express), Firebase Admin SDK, REST endpoints (see backend/server.js)
- **Data:** Firestore (see firestore.rules), Firebase Auth, Firebase Storage

## Architecture & Patterns
- **Role-based Routing:**
  - User role (ADMIN, MERCHANT, MEMBER, etc.) is stored in localStorage and determines route access in App.js
  - See `AdminRoute`, `MerchantRoute`, `MemberRoute` in `src/pages/` for access control
- **Component Structure:**
  - Shared UI and dialogs in `src/components/` (e.g., TransferFundsDialog, Topbar, splashscreen)
  - Route-level pages grouped by user type in `src/pages/admin/`, `src/pages/merchant/`, `src/pages/member/`
- **Dialog Pattern:**
  - All dialogs are in `src/components/dialogs/` or `src/components/Topbar/dialogs/`
- **Firebase Integration:**
  - `src/firebase.js` initializes both main and secondary Firebase apps for isolated auth flows
  - Firestore uses `experimentalForceLongPolling` and disables persistence for reliability
- **Backend Integration:**
  - Backend runs from `backend/server.js` (see TRANSFER_SETUP.md)
  - Endpoints expect authentication (idToken) and are called from frontend dialogs/components

## Developer Workflows
- **Frontend:**
  - Start: `npm start` (http://localhost:3000)
  - Build: `npm run build`
  - Test: `npm test`
- **Backend:**
  - Start: `cd backend && node server.js` (http://localhost:5000)
  - Configure environment via `backend/.env` (see TRANSFER_SETUP.md)
- **Firestore Rules:**
  - Update via `firebase deploy --only firestore:rules` or manually in Firebase Console

## Project-Specific Conventions
- **Role Names:** Always uppercase (e.g., ADMIN, MERCHANT, MEMBER)
- **API URLs:** Local backend defaults to http://localhost:5000; update hardcoded URLs in dialogs/components for production
- **Sensitive Data:** Never commit secrets; use .env files for all credentials
- **Component Import Paths:** Use relative imports from `src/components` and `src/pages` (no absolute imports)
- **Dialog Patterns:** All dialogs are in `src/components/dialogs` or nested under `Topbar/dialogs`
- **Firestore Data Model:**
  - See `firestore.rules` for access logic and collection structure (users, transferFunds, paybackEntries, etc.)

## Integration Points
- **Transfer Funds:**
  - Backend: `/api/transfer-funds` (see backend/server.js)
  - Frontend: `src/components/Topbar/dialogs/TransferFundsDialog.jsx`
- **Passive Income Transfer:**
  - Backend: `/api/transfer-passive-income` (see backend/server.js)
- **Chat/AI:**
  - Backend: `/api/chat` (OpenAI integration)
- **Firestore Security:**
  - See `firestore.rules` for custom role-based access logic

## References
- [README.md](../README.md): React scripts and usage
- [TRANSFER_SETUP.md](../TRANSFER_SETUP.md): Backend and transfer setup
- [firestore.rules](../firestore.rules): Firestore security and data model
- [src/firebase.js](../src/firebase.js): Firebase client setup
- [backend/server.js](../backend/server.js): Backend API endpoints

---
For new features, follow the role-based routing and dialog/component patterns. Update this file with any new conventions or workflows.
