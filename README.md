# Bus Management System

A complete backend system for managing a fleet of 50 buses with real-time dashboard updates and automated scheduling.

## Features

- 🚌 **50 Buses** with status tracking (AVAILABLE, RUNNING, REST, MAINTENANCE)
- 👨‍✈️ **Driver Management** with 8-hour work limit tracking
- 🛣️ **Up to 10 Routes** with duration-based assignments
- ⏰ **Automated Scheduling** via cron job (every 5 minutes)
- 📡 **Real-time Updates** via Socket.IO
- 🔐 **JWT Authentication** for admin operations
- 📊 **Full Activity Logging** for audit trails

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Real-time:** Socket.IO
- **Scheduling:** node-cron
- **Auth:** JWT (jsonwebtoken)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local) **OR** Docker

### Installation (New Device Setup)

```bash
# Clone and run setup script
cd woyce_Interview

# Windows:
setup.bat

# Linux/Mac:
chmod +x setup.sh && ./setup.sh
```

The script will:
1. Install npm dependencies
2. Let you choose local PostgreSQL or Docker
3. Create database and run migrations
4. Seed sample data

### Manual Setup

```bash
# Install dependencies
npm install

# Option A: Local PostgreSQL
createdb bus_management
npm run db:migrate
npm run db:seed

# Option B: Docker PostgreSQL
docker-compose up -d

# Start server
npm run dev
```

Server runs on `http://localhost:3000`

### Default Admin Login

```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Project Structure

```
src/
├── config/          # Environment, database, socket config
├── controllers/     # Request handlers
├── cron/            # Scheduled job (5-min assignment check)
├── middlewares/     # Auth, error handling, validation
├── migrations/      # SQL schema and seed data
├── models/          # Database models
├── routes/          # Express route definitions
├── services/        # Business logic
├── sockets/         # Socket.IO handlers
├── utils/           # Constants, helpers, logger
├── docs/            # Documentation
└── app.js           # Entry point
```

## API Overview

| Base Path | Description |
|-----------|-------------|
| `/api/admin` | Admin operations (auth required) |
| `/api/buses` | Bus management |
| `/api/drivers` | Driver management |
| `/api/routes` | Route management |
| `/api/activities` | Activity logs |
| `/api/history` | Entity history |

## Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Get JWT token |
| GET | `/api/admin/dashboard` | Dashboard stats |
| POST | `/api/admin/force-assign/bus` | Force assign bus |
| POST | `/api/admin/force-assign/driver` | Force assign driver |
| GET | `/api/history/bus/:id` | Bus activity history |

## Business Rules

- **Bus:** Max 3 rounds/day → REST status
- **Driver:** Max 8 hours/day → OFF_DUTY status
- **Cron:** Runs every 5 minutes to ensure routes have valid assignments
- **Force Assignment:** Admin can override, respecting daily limits

## Environment Variables

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bus_management
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

## Documentation

See [docs/flow.md](src/docs/flow.md) for:
- Assignment flows
- State transitions
- Edge cases
- Socket events
- Full API reference
