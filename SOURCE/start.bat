@echo off
title FLOW Server (Dev Mode)
color 0A
echo ==========================================
echo   FLOW Worship - Server (Source Mode)
echo   Versi ini membaca source langsung
echo   Perubahan server.node.js langsung aktif
echo   Port: 7080 — dipindah dr 7070 (port 7070 dicaplok AnyDesk, public 502)
echo ==========================================
echo.
echo Memulai server di port 7080...
set PORT=7080
set FLOW_PUBLIC_URL=https://flow.davidsatriatunnel.online
node server.node.js
echo.
echo Server berhenti. Tekan tombol apapun untuk menutup.
pause >nul
