# CEO Sidebar Debug Guide

## Issue
Admin sidebar not displaying for CEO role user.

## Fixes Applied
1. **Topbar.jsx (Line 343)**: Fixed wallet section visibility check from `userData.role !== "admin"` to `!["ADMIN", "CEO"].includes(userData.role?.toUpperCase())`

2. **adminWithdrawals.jsx (Line 50-51, 185)**: Standardized role to uppercase and updated role check to `["ADMIN", "CEO"]`

3. **adminDeposits.jsx (Line 57-59, 238)**: Standardized role to uppercase and updated role check to `["ADMIN", "CEO"]`

4. **AppBottomNav.jsx (Line 60-70)**: Added defensive role handling with trim, debug logging, and consistent role detection

## How to Verify

### Step 1: Check Browser Console
When logged in as CEO, open browser DevTools (F12) and check the console for:
```
[AppBottomNav] Admin/CEO Sidebar - Role: CEO Upper: CEO Layout: sidebar
```

### Step 2: Verify localStorage
In browser console, run:
```javascript
console.log('userRole:', localStorage.getItem('userRole'));
```
Expected output: `userRole: CEO` (should be uppercase)

### Step 3: Check Firestore
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Check the "users" collection
4. Find the CEO user
5. Verify the `role` field is set to "CEO" (exact case)

## Possible Root Causes

### If sidebar still doesn't show:
1. **Role not stored correctly in Firestore**
   - Check user document, `role` field should be exactly "CEO"
   - If it's "ceo", "Ceo", or blank - update it

2. **Role not in localStorage**
   - Check if you're on the correct browser/incognito mode
   - Clear localStorage: `localStorage.clear()` in console, then login again

3. **Viewport/Screen size issue**
   - On mobile (viewport < 900px), sidebar shows as drawer (click menu button)
   - On desktop, sidebar should auto-show on left side

4. **Browser cache issue**
   - Hard refresh with Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Clear browser cache

## Next Steps
1. Rebuild the React app: `npm run build`
2. Clear browser cache
3. Log out completely (clear localStorage)
4. Log back in as CEO
5. Check console logs (Step 1 above)
6. Verify sidebar displays on admin/dashboard page

## Files Modified
- src/components/Topbar.jsx
- src/pages/admin/adminWithdrawals.jsx  
- src/pages/admin/adminDeposits.jsx
- src/components/AppBottomNav.jsx
