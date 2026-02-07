#!/bin/bash
# ========================================
# Bus Management System - Setup Script
# Run this after cloning on a new device
# ========================================

echo ""
echo "=================================="
echo "Bus Management System Setup"
echo "=================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[1/4] Installing dependencies..."
    npm install
else
    echo "[1/4] Dependencies already installed"
fi

echo ""
echo "[2/4] Choose database setup:"
echo "  1. Local PostgreSQL (default)"
echo "  2. Docker PostgreSQL"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "2" ]; then
    echo ""
    echo "Starting Docker PostgreSQL..."
    docker-compose up -d
    echo "Waiting for database to be ready..."
    sleep 5
    echo "Docker PostgreSQL started!"
else
    echo ""
    echo "Using local PostgreSQL"
    echo "Make sure PostgreSQL is running on localhost:5432"
    echo ""
    
    echo "[3/4] Creating database..."
    psql -U postgres -c "CREATE DATABASE bus_management;" 2>/dev/null || echo "Database may already exist"

    echo ""
    echo "[4/4] Running migrations and seeding data..."
    psql -U postgres -d bus_management -f src/migrations/001_initial_schema.sql
    psql -U postgres -d bus_management -f src/migrations/002_seed_data.sql
fi

echo ""
echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo "To start the server:"
echo "  npm run dev"
echo ""
echo "Admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Server will run on: http://localhost:3000"
echo ""
