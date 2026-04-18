# Deployment Guide

## Architecture Overview

The Amayan Savings project uses a multi-app architecture with separate applications for each user role:

- **Main App**: Admin and Member login, role selection
- **Rider-App**: Dedicated Rider platform
- **Merchant-App**: Dedicated Merchant management
- **User-App**: Member shopping and orders

## Local Development

### Port Configuration

Each app runs on a different port:

```
Main App:       http://localhost:5173  (Vite default)
Rider-App:      http://localhost:3003  (vite --port 3003)
Merchant-App:   http://localhost:3002  (vite --port 3002)
User-App:       http://localhost:3001  (vite --port 3001)
Backend:        http://localhost:5000  (Node.js server)
```

### Development URL Structure

**Local Flow:**
1. User goes to `http://localhost:5173/login
2. Selects role (Rider, Merchant, or Member/Admin)
3. For Rider login: Redirects to `http://localhost:3003/login`
4. For Merchant login: Shows splash, then redirects to `http://localhost:3002/dashboard`
5. For Member/Admin: Stays in main app

## Production Deployment (GitHub Pages)

### GitHub Pages Structure

All apps are deployed under a single GitHub Pages site with subpaths:

```
Main App:       https://lutz1.github.io/damayan-savings/
Rider-App:      https://lutz1.github.io/damayan-savings/rider/
Merchant-App:   https://lutz1.github.io/damayan-savings/merchant/
User-App:       https://lutz1.github.io/damayan-savings/user/
```

### Base Path Configuration

Each Vite app's `vite.config.js` includes:

```javascript
base: process.env.NODE_ENV === "production" 
  ? "/damayan-savings/{app}/" 
  : "/",
```

This ensures:
- Development: Assets load from `/` (local port)
- Production: Assets load from `/damayan-savings/{app}/` (GitHub Pages subpath)

### Production URL Structure

**Production Flow:**
1. User goes to `https://lutz1.github.io/damayan-savings/login`
2. Selects role (Rider, Merchant, or Member/Admin)
3. For Rider login: Redirects to `https://lutz1.github.io/damayan-savings/rider/login`
4. For Merchant login: Shows splash, then redirects to `https://lutz1.github.io/damayan-savings/merchant/dashboard`
5. For Member/Admin: Stays in main app

## Dynamic Redirect Logic

### Main App (`src/pages/login.jsx`)

The login page implements intelligent routing that detects the environment:

```javascript
// Rider redirect
const riderUrl = window.location.hostname === "localhost"
  ? "http://localhost:3003"
  : `${window.location.origin}/damayan-savings/rider`;
window.location.href = `${riderUrl}/login`;

// Merchant redirect (via splash screen)
const merchantUrl = window.location.hostname === "localhost"
  ? "http://localhost:3002"
  : `${window.location.origin}/damayan-savings/merchant`;
setPostSplashTarget(`${merchantUrl}/dashboard`);
```

**Detection Logic:**
- `window.location.hostname === "localhost"` → Use local ports
- Otherwise → Use full GitHub Pages URL with subpath

## Building for GitHub Pages

### Build Command

```bash
npm run build
```

This creates a `build/` directory with all assets:
- Main app assets at root
- Rider-app assets under `/damayan-savings/rider`
- Merchant-app assets under `/damayan-savings/merchant`
- User-app assets under `/damayan-savings/user`

### Pre-deployment Checklist

1. ✅ Verify all `vite.config.js` files have correct base paths
2. ✅ Verify `.env.production` has correct API URLs
3. ✅ Test local builds: `npm run build && npm run preview`
4. ✅ Verify authentication works cross-app
5. ✅ Test all role redirects (Rider, Merchant, Admin, Member)

## Environment Variables

### Development (`.env` or `.env.local`)

```
REACT_APP_API_BASE_URL=http://localhost:5000
```

### Production (`.env.production`)

```
REACT_APP_API_BASE_URL=https://damayan-savings-backend.onrender.com
VITE_RIDER_APP_URL=https://lutz1.github.io/damayan-savings/rider
VITE_MERCHANT_APP_URL=https://lutz1.github.io/damayan-savings/merchant
VITE_USER_APP_URL=https://lutz1.github.io/damayan-savings/user
```

## Firebase Configuration

### Shared Firebase Instance

All apps share the same Firebase project but use separate app instances via `createFirebaseClients()`:

```javascript
// src/firebase.js (main app initialization)
const { auth, db } = createFirebaseClients("MainApp");

// src/pages/merchant/merchantDashboard.jsx
const { auth, db, storage } = createFirebaseClients("MerchantApp");

// src/pages/rider/riderDashboard.jsx
const { auth, db, storage } = createFirebaseClients("RiderApp");
```

This ensures:
- ✅ Auth state persists across apps (same Firebase project)
- ✅ Each app has independent app instance
- ✅ Firestore rules apply consistently

## Troubleshooting

### Issue: "Cannot find module" after deployment

**Solution:** Verify base paths in `vite.config.js` match GitHub Pages URL structure

### Issue: Auth state not persisting between apps

**Solution:** Ensure all apps use same Firebase project credentials

### Issue: Assets 404 on GitHub Pages

**Solution:** Check that `base` in `vite.config.js` includes trailing slash:
```javascript
base: "/damayan-savings/rider/"  // ✅ Correct
base: "/damayan-savings/rider"   // ❌ Wrong
```

### Issue: Local development works, production broken

**Solution:** This is usually due to base path mismatch. Verify:
1. All vite.config.js files have correct base paths
2. Router components use `<BrowserRouter>` (not `<HashRouter>`)
3. Test with `npm run build && npm run preview`

## Additional References

- [GitHub Pages Documentation](https://pages.github.com/)
- [Vite Base Configuration](https://vitejs.dev/config/base)
- [Firebase Javascript SDK](https://firebase.google.com/docs/web/setup)
