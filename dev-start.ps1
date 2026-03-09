# Fast Local Development Starter Script
# Start any or all apps with: .\dev-start.ps1 [app]
# Examples:
#   .\dev-start.ps1 all          # Start all 4 apps
#   .\dev-start.ps1 main         # Start main app only
#   .\dev-start.ps1 rider        # Start rider-app only
#   .\dev-start.ps1 merchant     # Start merchant-app only
#   .\dev-start.ps1 user         # Start user-app only

param([string]$app = "all")

$rootPath = Get-Location

switch ($app.ToLower()) {
    "main" {
        Write-Host "`n✨ Starting MAIN APP`n" -ForegroundColor Magenta
        Push-Location $rootPath
        npm run dev
        Pop-Location
    }
    
    "rider" {
        Write-Host "`n🚴 Starting RIDER-APP`n" -ForegroundColor Magenta
        Push-Location "$rootPath\apps\rider-app"
        npm run dev
        Pop-Location
    }
    
    "merchant" {
        Write-Host "`n🏪 Starting MERCHANT-APP`n" -ForegroundColor Magenta
        Push-Location "$rootPath\apps\merchant-app"
        npm run dev
        Pop-Location
    }
    
    "user" {
        Write-Host "`n👤 Starting USER-APP`n" -ForegroundColor Magenta
        Push-Location "$rootPath\apps\user-app"
        npm run dev
        Pop-Location
    }
    
    "all" {
        Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║  🎯 STARTING ALL DEVELOPMENT SERVERS                          ║
╚════════════════════════════════════════════════════════════════╝

📱 Main App:          http://localhost:5173
🚴 Rider-App:        http://localhost:3003
🏪 Merchant-App:     http://localhost:3002
👤 User-App:         http://localhost:3001

Press Ctrl+C in any terminal to stop that server.
"@ -ForegroundColor Green
        
        # Open each app in separate terminals
        Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "cd '$rootPath'; npm run dev" -WindowStyle Normal
        Start-Sleep -Seconds 2
        
        Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "cd '$rootPath\apps\rider-app'; npm run dev" -WindowStyle Normal
        Start-Sleep -Seconds 2
        
        Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "cd '$rootPath\apps\merchant-app'; npm run dev" -WindowStyle Normal
        Start-Sleep -Seconds 2
        
        Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "cd '$rootPath\apps\user-app'; npm run dev" -WindowStyle Normal
        
        Write-Host "`n✅ All development servers started in separate terminals!`n" -ForegroundColor Green
        Write-Host "⏳ Give servers ~30 seconds to initialize..." -ForegroundColor Yellow
    }
    
    default {
        Write-Host @"
❌ Unknown app: $app

Usage: .\dev-start.ps1 [app]

Options:
  all       - Start all 4 apps in separate terminals
  main      - Start main app (http://localhost:5173)
  rider     - Start rider-app (http://localhost:3003)
  merchant  - Start merchant-app (http://localhost:3002)
  user      - Start user-app (http://localhost:3001)

Examples:
  .\dev-start.ps1 all
  .\dev-start.ps1 rider
  .\dev-start.ps1 merchant
"@ -ForegroundColor Red
        exit 1
    }
}
