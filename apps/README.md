# Apps Directory

This directory is now largely deprecated. The separate frontend applications have been consolidated into the main application:

- **User App** (`apps/user-app`) → Integrated into `src/pages/marketplace/` and `src/pages/member/`
- **Merchant App** (`apps/merchant-app`) → Integrated into `src/pages/merchant/`
- **Rider App** (`apps/rider-app`) → Integrated into `src/pages/rider/`

## Current Structure

All user interfaces are now accessible from the main `src/` directory with role-based routing:

- **Marketplace** (User Shop): `/marketplace/*` routes in `src/pages/marketplace/`
- **Merchant Portal**: `/merchant/*` routes in `src/pages/merchant/`
- **Rider Dashboard**: `/rider/*` routes in `src/pages/rider/`
- **Member Dashboard**: `/member/*` routes in `src/pages/member/`
- **Admin Dashboard**: `/admin/*` routes in `src/pages/admin/`

## Running the Application

From the repository root, run the consolidated application:

```bash
npm install
npm start      # or npm run dev
npm run build
```

All features (user, merchant, rider, admin, member) are now part of a single Vite application with unified routing.

## Historical Reference

Previously, this repository contained 3 separate Vite applications sharing Firebase resources. For historical information about the old app structure, see archived documentation or git history.

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
