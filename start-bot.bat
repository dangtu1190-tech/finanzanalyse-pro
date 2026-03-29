@echo off
title FinanzAnalyse Pro - Auto-Trader Bot
echo ================================================
echo   FinanzAnalyse Pro - Auto-Trader Bot
echo   Druecke Ctrl+C zum Beenden
echo ================================================
echo.

cd /d "%~dp0"

:: Build falls noetig
if not exist "dist\index.html" (
    echo [BUILD] Erstelle Production Build...
    call npm run build
    echo.
)

echo [START] Bot startet auf http://localhost:3000
echo [START] Auto-Trader prueft alle 15 Minuten
echo.

node server.js
pause
