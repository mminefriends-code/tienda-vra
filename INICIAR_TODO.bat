@echo off
title INICIANDO TIENDA VRA (API + WEB + TUNEL)
color 0A
echo ======================================================
echo          INICIANDO PLATAFORMA TIENDA VRA
echo ======================================================
echo.

echo 1. Iniciando API Backend (NestJS en puerto 3000)...
start "Tienda VRA - API Backend" cmd /k "cd /d %~dp0PROTOTIPO\api && npm run start:dev"

timeout /t 4 >nul

echo 2. Iniciando Frontend Web (Vite en puerto 5173)...
start "Tienda VRA - Web Frontend" cmd /k "cd /d %~dp0PROTOTIPO\web && npm run dev"

timeout /t 3 >nul

echo 3. Iniciando Tunel Cloudflare (Internet Publico)...
start "Tienda VRA - Tunel Publico" cmd /k "C:\Users\Junior\cloudflared.exe tunnel --url http://localhost:3000"

echo.
echo ======================================================
echo  TODO LISTO!
echo   - Local PC:   http://localhost:5173
echo   - Red Wi-Fi:  http://192.168.0.11:5173
echo   - Celular:    Abre la app Tienda VRA en tu Tecno Spark
echo ======================================================
pause

