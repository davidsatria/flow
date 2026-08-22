@echo off
title FLOW Server (Dev Mode)
color 0A
echo ==========================================
echo   FLOW Worship - Server (Source Mode)
echo   Versi ini membaca source langsung
echo   Perubahan server.node.js langsung aktif
echo ==========================================
echo.
echo Memulai server...
node server.node.js
echo.
echo Server berhenti. Tekan tombol apapun untuk menutup.
pause >nul
