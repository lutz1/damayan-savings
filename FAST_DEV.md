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
.\dev-start.ps1 all
# All 4 apps start automatically in separate terminals
```

### 📁 Quick Navigation
```powershell
# From root, open terminal in any app:
cd apps/rider-app
cd apps/merchant-app
cd apps/user-app

# OR double-click the .bat files
```

### 🔧 Install Dependencies
```powershell
# For individual app:
cd apps/rider-app
npm install

# For all apps at once:
cd apps/rider-app && npm install
cd ../merchant-app && npm install
cd ../user-app && npm install
```

### 🐛 Debugging
- **Main app issues?** Terminal 1 shows logs for main + admin/member features
- **Rider-app issues?** Terminal 2 shows logs for rider platform
- **Merchant-app issues?** Terminal 3 shows logs for merchant platform
- **User-app issues?** Terminal 4 shows logs for user shopping

### ⚙️ Build for Production
```powershell
# Build main app
npm run build

# Build all sub-apps
cd apps/rider-app && npm run build
cd ../merchant-app && npm run build
cd ../user-app && npm run build
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

### Per App (run from app directory)
```powershell
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build locally
npm test           # Run tests
```

### Root (main app only)
```powershell
npm start          # Same as npm run dev
npm run test       # Run tests
```

---

## Environment Variables

All apps share `.env.production` for production settings:
- `REACT_APP_API_BASE_URL` - Backend API URL
- `VITE_RIDER_APP_URL` - Rider-app production URL
- `VITE_MERCHANT_APP_URL` - Merchant-app production URL
- `VITE_USER_APP_URL` - User-app production URL

For local dev, these are auto-detected based on `http://localhost:xxxx` ports.

---

## Quick Reference

| Need | Command |
|------|---------|
| Start all 4 apps | `.\dev-start.ps1 all` |
| Start rider-app only | `.\dev-start.ps1 rider` |
| Start merchant-app only | `.\dev-start.ps1 merchant` |
| Start user-app only | `.\dev-start.ps1 user` |
| Start main app only | `.\dev-start.ps1 main` |
| Navigate to rider-app | Double-click `go-rider.bat` or `cd apps/rider-app` |
| Navigate to merchant-app | Double-click `go-merchant.bat` or `cd apps/merchant-app` |
| Navigate to user-app | Double-click `go-user.bat` or `cd apps/user-app` |
| Check main app | `http://localhost:5173` |
| Check rider-app | `http://localhost:3003` |
| Check merchant-app | `http://localhost:3002` |
| Check user-app | `http://localhost:3001` |

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
