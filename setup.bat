@echo off
REM ========================================
REM Bus Management System - Setup Script
REM Run this after cloning on a new device
REM ========================================

echo.
echo ==================================
echo Bus Management System Setup
echo ==================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [1/4] Installing dependencies...
    call npm install
) else (
    echo [1/4] Dependencies already installed
)

echo.
echo [2/4] Choose database setup:
echo   1. Local PostgreSQL (default)
echo   2. Docker PostgreSQL
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="2" (
    echo.
    echo Starting Docker PostgreSQL...
    docker-compose up -d
    echo Waiting for database to be ready...
    timeout /t 5 /nobreak > nul
) else (
    echo.
    echo Using local PostgreSQL
    echo Make sure PostgreSQL is running on localhost:5432
    echo.
    
    echo [3/4] Creating database...
    psql -U postgres -c "CREATE DATABASE bus_management;" 2>nul || echo Database may already exist

    echo.
    echo [4/4] Running migrations and seeding data...
    psql -U postgres -d bus_management -f src/migrations/001_initial_schema.sql
    psql -U postgres -d bus_management -f src/migrations/002_seed_data.sql
)

echo.
echo ==================================
echo Setup Complete!
echo ==================================
echo.
echo To start the server:
echo   npm run dev
echo.
echo Admin credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Server will run on: http://localhost:3000
echo.
pause
