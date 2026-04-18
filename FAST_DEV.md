# ⚡ Fast Local Development Guide

## Quick Start

Two ways to dev locally:

### Option 1: Batch Files (Easiest for Navigation)
Double-click any of these from File Explorer:
```
go-rider.bat        → Opens command prompt in rider-app/
go-merchant.bat     → Opens command prompt in merchant-app/
go-user.bat         → Opens command prompt in user-app/
```

Then run:
```powershell
npm run dev
```

### Option 2: PowerShell Script (Best for Automation)

#### Start individual app:
```powershell
.\dev-start.ps1 rider      # Opens rider-app dev server
.\dev-start.ps1 merchant   # Opens merchant-app dev server
.\dev-start.ps1 user       # Opens user-app dev server
.\dev-start.ps1 main       # Opens main app dev server
```

#### Start all 4 apps at once:
```powershell
.\dev-start.ps1 all
```

This opens 4 separate terminals with all servers running.

---

## Port Configuration

| App | Port | URL | Script |
|-----|------|-----|--------|
| **Main** | 5173 | `http://localhost:5173` | (root `npm run dev`) |
| **Rider-App** | 3003 | `http://localhost:3003` | `.\dev-start.ps1 rider` |
| **Merchant-App** | 3002 | `http://localhost:3002` | `.\dev-start.ps1 merchant` |
| **User-App** | 3001 | `http://localhost:3001` | `.\dev-start.ps1 user` |

---

## Common Workflows

### Workflow 1: Work on Single App
```powershell
# From root directory
.\dev-start.ps1 rider

# OR double-click go-rider.bat, then:
npm run dev
```

### Workflow 2: Full Stack Testing (All Apps Running)
```powershell
.\dev-start.ps1 all

# Wait ~30 seconds for all servers to start
# Then navigate to http://localhost:5173 (main app login page)
```

### Workflow 3: Test Role Navigation
```powershell
# Terminal 1: Start main app
.\dev-start.ps1 main

# Terminal 2: Start rider-app (after main starts)
.\dev-start.ps1 rider

# Terminal 3: Start merchant-app (after main starts)
.\dev-start.ps1 merchant
```

Then test:
1. Go to `http://localhost:5173/login`
2. Click "Rider Login" → Should navigate to `http://localhost:3003/login`
3. Click "Merchant Login" → Should navigate to `http://localhost:3002/dashboard`
4. Use form to login as Member/Admin

---

## Development Tips

### 🚀 Fastest Setup
```powershell
# Install dependencies once (from root)
npm install

# Start unified dev server
npm start  # or npm run dev

# Access all features at http://localhost:5173
```

### 📁 Project Structure
```powershell
src/
├── pages/
│   ├── admin/          ← Admin dashboard
│   ├── merchant/       ← Merchant portal (formerly apps/merchant-app)
│   ├── rider/          ← Rider dashboard (formerly apps/rider-app)
│   ├── member/         ← Member dashboard
│   └── marketplace/    ← Shopping interface (formerly apps/user-app)
├── components/         ← Shared components
├── utils/              ← Shared utilities
└── App.jsx             ← Main router and role-based routing
```

### 🔧 Install Dependencies
```powershell
# Install once from root (all features included)
npm install
```

### 🐛 Debugging
- All features (Admin, Merchant, Rider, Member, Marketplace) are in a single dev server
- Check browser console and terminal for errors
- Use role-based login to test different portals:
  - Admin/CEO: `/login`
  - Merchant: `/login/merchant`
  - Rider: `/rider/login`
  - Member/User: `/login` (various member roles)

### ⚙️ Build for Production
```powershell
# Build unified application (all features included)
npm run build

# Output: dist/ folder ready for deployment
```

---

## Troubleshooting

### "Port already in use"
```powershell
# Find and kill process using port
# Windows:
netstat -ano | findstr :3003
taskkill /PID <PID> /F

# PowerShell (cleaner):
Get-Process -Id (Get-NetTCPConnection -LocalPort 3003 -ErrorAction Ignore).OwningProcess | Stop-Process -Force
```

### "Cannot find module"
```powershell
# Run from app directory:
cd apps/rider-app
npm install
npm run dev
```

### Script execution policy error
```powershell
# Run PowerShell as Administrator, then:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Useful npm Scripts

### Main Commands (unified application)
```powershell
npm start          # Start dev server (Vite)
npm run dev        # Same as npm start
npm run build      # Build for production
npm run preview    # Preview production build locally
npm test           # Run tests
npm run test:run   # Run tests once
```

---

## Environment Variables

For production settings, use `.env.production`:
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps for merchant store settings
- `VITE_GOOGLE_MAPS_MAP_ID` - Google Maps Map ID

For local dev, these are auto-detected based on `http://localhost` ports.

---

## Quick Reference

| Need | Command |
|------|---------|  
| Start dev server | `npm start` |
| Build for production | `npm run build` |
| Run tests | `npm test` |
| Access application | `http://localhost:5173` |
| Admin login | `/login` → username: admin |
| Merchant login | `/login/merchant` → merchant account |
| Rider login | `/rider/login` → rider account |
| Member login | `/login` → member account |
| Marketplace | `/marketplace/shop` |

---

## Architecture Reminder

```
d:\amayan-savings\
├── src/                    ← Main app (React, Admin/Member login)
├── apps/
│   ├── rider-app/         ← Rider platform
│   ├── merchant-app/      ← Merchant platform
│   └── user-app/          ← User shopping platform
├── backend/               ← Node.js API server
├── dev-start.ps1          ← PowerShell starter (automation)
├── go-rider.bat           ← Quick nav to rider-app
├── go-merchant.bat        ← Quick nav to merchant-app
└── go-user.bat            ← Quick nav to user-app
```

---

## Next Steps

1. **Try single app dev:**
   ```powershell
   .\dev-start.ps1 rider
   # Navigate to http://localhost:3003
   ```

2. **Test full flow:**
   ```powershell
   .\dev-start.ps1 all
   # Login flow: Main app → Select role → Go to respective app
   ```

3. **Deploy to GitHub Pages:**
   ```powershell
   npm run build
   # Then push to GitHub (CI/CD handles deployment)
   ```
