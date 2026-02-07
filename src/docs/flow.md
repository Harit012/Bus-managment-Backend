# Bus Management System - Flow Documentation

## Overview

A backend system for managing 50 buses, up to 10 routes, and drivers with real-time dashboard updates and automated scheduling.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
│                  (Admin Dashboard via Socket.IO)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express.js Server                           │
│    ┌──────────────┬───────────────┬────────────────────────┐    │
│    │   REST API   │   Socket.IO   │    Cron Scheduler      │    │
│    │   Endpoints  │   Real-time   │    (every 5 min)       │    │
│    └──────────────┴───────────────┴────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Service Layer (MVC)                          │
│  ┌─────────────┬───────────┬────────────┬─────────────────┐     │
│  │ Assignment  │    Bus    │   Driver   │     Route       │     │
│  │  Service    │  Service  │  Service   │    Service      │     │
│  └─────────────┴───────────┴────────────┴─────────────────┘     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
│   buses | drivers | routes | route_assignments | activity_logs  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Business Rules

| Entity | Rule | Limit |
|--------|------|-------|
| Bus | Max rounds per day | 3 |
| Bus | Status values | AVAILABLE, RUNNING, REST, MAINTENANCE |
| Driver | Max work time per day | 480 minutes (8 hours) |
| Driver | Status values | AVAILABLE, RUNNING, OFF_DUTY |
| Route | Status values | ACTIVE, COMPLETED |
| System | Total buses | 50 |
| System | Max routes | 10 |

---

## Flow 1: Normal Assignment Flow

When a route needs a bus and driver assigned automatically:

```
1. CRON JOB or MANUAL TRIGGER
         │
         ▼
2. Check route has active assignment?
         │
    ┌────┴────┐
   NO         YES
    │          │
    ▼          ▼
3. Find        Check if
   available   assignment
   driver      is valid
    │               │
    ▼               ▼
4. Find        (Skip if
   available   valid)
   bus
    │
    ▼
5. Create RouteAssignment
    │
    ▼
6. Update bus → RUNNING
   Update driver → RUNNING
    │
    ▼
7. Log activity + Emit Socket event
```

### Assignment Selection Criteria

**findAvailableDriver(routeDuration):**
- Status = AVAILABLE
- `worked_minutes_today + routeDuration <= 480`
- Sorted by `worked_minutes_today ASC` (least worked first)

**findAvailableBus():**
- Status = AVAILABLE
- `rounds_today < 3`
- Sorted by `rounds_today ASC` (least used first)

---

## Flow 2: Cron-Based Reassignment

The scheduler runs every 5 minutes (`*/5 * * * *`):

```
1. CRON TRIGGERED
         │
         ▼
2. Reset daily counters (if new day)
   - buses.rounds_today → 0
   - drivers.worked_minutes_today → 0
         │
         ▼
3. For each ACTIVE route:
         │
    ┌────┴────────────────────┐
    │                         │
  Has Assignment?         No Assignment
    │                         │
    ▼                         ▼
  Check validity          Auto-assign
    │                    bus + driver
    ▼
  Bus in MAINTENANCE/REST?
    │
   YES → Replace bus
    │
  Driver OFF_DUTY?
    │
   YES → Replace driver
         │
         ▼
4. Emit CRON_EXECUTED event
5. Emit DASHBOARD_REFRESH event
```

### Cron Replacement Rules

- If bus goes to **MAINTENANCE** or **REST** → Find replacement bus
- If driver goes to **OFF_DUTY** → Find replacement driver
- Admin-forced assignments are **respected** unless invalid
- All replacements are logged with `is_admin_forced = false`

---

## Flow 3: Admin Force Override

Admin can override automatic assignments:

### Force Assign Bus

```
POST /api/admin/force-assign/bus
Body: { routeId, busId }

1. Validate bus:
   - NOT in REST
   - NOT in MAINTENANCE
   - rounds_today < 3

2. If route has existing assignment:
   - Unassign previous bus
   - Set previous bus → AVAILABLE
   - Update assignment with new bus

3. If no existing assignment:
   - Find available driver
   - Create new assignment

4. Update new bus → RUNNING
5. Increment bus rounds_today
6. Log with is_admin_forced = true
7. Emit ADMIN_FORCE_ASSIGNMENT event
```

### Force Assign Driver

```
POST /api/admin/force-assign/driver
Body: { routeId, driverId }

1. Validate driver:
   - NOT OFF_DUTY
   - remaining_minutes >= route.duration_minutes

2. If route has existing assignment:
   - Unassign previous driver
   - Set previous driver → AVAILABLE
   - Update assignment with new driver

3. If no existing assignment:
   - Find available bus
   - Create new assignment

4. Update new driver → RUNNING
5. Log with is_admin_forced = true
6. Emit ADMIN_FORCE_ASSIGNMENT event
```

---

## Flow 4: State Transitions

### Bus State Machine

```
                ┌──────────────────────────────┐
                │         AVAILABLE            │
                │  (can be assigned)           │
                └─────────────┬────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   RUNNING     │ │  MAINTENANCE  │ │     REST      │
    │ (on a route)  │ │ (admin set)   │ │ (3 rounds)    │
    └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
            │                 │                 │
            │  Admin:         │  Admin:         │  Admin:
            │  unassign       │  release        │  release
            │                 │                 │
            └─────────────────┴─────────────────┘
                              │
                              ▼
                        AVAILABLE
```

### Driver State Machine

```
                ┌──────────────────────────────┐
                │         AVAILABLE            │
                │  (can be assigned)           │
                └─────────────┬────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────────┐   ┌───────────────┐
            │   RUNNING     │   │   OFF_DUTY    │
            │ (on a route)  │   │ (8 hrs worked)│
            └───────┬───────┘   └───────┬───────┘
                    │                   │
                    │                   │  Admin:
                    │  unassign         │  set available
                    │                   │
                    └───────────────────┘
                              │
                              ▼
                        AVAILABLE
```

---

## Flow 5: Round Completion

When a route round completes:

```
1. Route round completed
         │
         ▼
2. Add route.duration_minutes to driver.worked_minutes_today
         │
         ▼
3. Check driver.worked_minutes_today >= 480?
         │
    ┌────┴────┐
   YES        NO
    │          │
    ▼          │
4. Driver →    │
   OFF_DUTY    │
    │          │
    ▼          │
5. Find        │
   replacement │
   driver      │
         │     │
         └─────┘
         │
         ▼
6. Check bus.rounds_today >= 3?
         │
    ┌────┴────┐
   YES        NO
    │          │
    ▼          │
7. Bus →       │
   REST        │
    │          │
    ▼          │
8. Find        │
   replacement │
   bus         │
         │     │
         └─────┘
         │
         ▼
9. Log activities + Emit events
```

---

## Edge Cases & Conflict Resolution

### 1. No Available Resources

**Scenario:** All buses are in REST/MAINTENANCE, no drivers available.

**Resolution:**
- Log warning message
- Route assignment remains empty
- Cron will retry in 5 minutes
- Admin can manually force a bus from REST (if needed)

### 2. Concurrent Force Assignments

**Scenario:** Admin force assigns while cron is running.

**Resolution:**
- Database transactions ensure atomicity
- Cron respects `is_forced = true` assignments
- Force assignments have higher priority

### 3. Mid-Route Status Change

**Scenario:** Bus sent to MAINTENANCE while on a route.

**Resolution:**
- Assignment is ended immediately
- Driver set to AVAILABLE
- Route logged as interrupted
- Cron will auto-assign replacement on next run

### 4. Driver Exceeds 8 Hours

**Scenario:** Route completes and driver now has > 480 minutes.

**Resolution:**
- Driver automatically set to OFF_DUTY
- Route assignment ended
- New driver assigned if available

### 5. Bus Reaches 3 Rounds

**Scenario:** Bus completes 3rd round of the day.

**Resolution:**
- Bus automatically set to REST
- Route assignment ended for bus (driver may continue with new bus)
- New bus assigned if available

---

## Socket.IO Events

| Event | Trigger | Data |
|-------|---------|------|
| `bus:statusChange` | Bus status updates | `{busId, busNumber, previousStatus, newStatus}` |
| `driver:statusChange` | Driver status updates | `{driverId, driverName, previousStatus, newStatus}` |
| `route:assignmentChange` | Assignment created/updated/ended | `{routeId, routeName, action, busId, driverId}` |
| `admin:forceAssignment` | Admin force operation | `{type, routeId, busId/driverId, adminId}` |
| `dashboard:refresh` | Data refresh needed | `{reason, actionsCount}` |
| `cron:executed` | Cron job completed | `{duration, actionsCount, actions[]}` |

---

## API Endpoints Summary

### Admin (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/buses` | All buses with assignments |
| GET | `/api/admin/drivers` | All drivers with assignments |
| GET | `/api/admin/routes/active` | Active routes with assignments |
| POST | `/api/admin/buses/:id/maintenance` | Set bus to MAINTENANCE |
| POST | `/api/admin/buses/:id/available-from-maintenance` | Release from MAINTENANCE |
| POST | `/api/admin/buses/:id/available-from-rest` | Release from REST |
| POST | `/api/admin/force-assign/bus` | Force assign bus |
| POST | `/api/admin/force-assign/driver` | Force assign driver |
| POST | `/api/admin/auto-assign/:routeId` | Trigger auto-assignment |

### History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history/bus/:id` | Bus activity history |
| GET | `/api/history/driver/:id` | Driver activity history |
| GET | `/api/history/route/:id` | Route activity history |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create PostgreSQL database
createdb bus_management

# 3. Run migrations
npm run db:migrate

# 4. Seed data
npm run db:seed

# 5. Start server
npm run dev

# Server runs on http://localhost:3000
# Socket.IO available on same port
```

## Default Admin Credentials

- **Username:** admin
- **Password:** admin123

Get JWT token:
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
