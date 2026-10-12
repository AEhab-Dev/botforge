# BotForge startup script
# Double-click this file (or run it in PowerShell) to start everything

Write-Host ""
Write-Host "  Starting BotForge..." -ForegroundColor Cyan
Write-Host ""

# Kill anything already on ports 3000 and 3001 to avoid EADDRINUSE
$ports = @(3000, 3001)
foreach ($port in $ports) {
  $pids = netstat -ano | Select-String ":$port\s" | ForEach-Object {
    ($_ -split '\s+')[-1]
  } | Sort-Object -Unique
  foreach ($pid in $pids) {
    if ($pid -match '^\d+$' -and $pid -ne '0') {
      try { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}
Start-Sleep -Seconds 1

# Start the API in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\apps\api'; Write-Host '  [API] BotForge API' -ForegroundColor Cyan; pnpm dev"

# Wait for the API to be ready
Start-Sleep -Seconds 5

# Start the deployment worker in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\services\deployment-worker'; Write-Host '  [WORKER] Deployment Worker' -ForegroundColor Yellow; pnpm dev"

# Wait a moment for the worker to connect to the DB
Start-Sleep -Seconds 3

# Start the frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\apps\web'; Write-Host '  [WEB] BotForge Frontend' -ForegroundColor Green; pnpm dev"

# Wait for Vite to start
Start-Sleep -Seconds 4

# Open the browser
Start-Process "http://localhost:3000"

Write-Host "  BotForge is starting up." -ForegroundColor Green
Write-Host "  Three windows will open: API, Worker, and Web." -ForegroundColor Green
Write-Host "  Close all three windows to stop the app." -ForegroundColor Yellow
Write-Host ""
