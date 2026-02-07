# Setup & Run Guide: Bus Management System

Follow these steps to set up and run the project on a new device.

## 📋 Prerequisites
- **Node.js** (v18 or higher)
- **Docker & Docker Compose**
- **NPM** (normally comes with Node.js)

---

## 🚀 Backend Setup

1. **Navigate to the Backend directory:**
   ```bash
   cd Backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   - Create a `.env` file based on `.env.example`
   - Ensure `DB_PORT` matches your Docker mapped port (default: `5433`)

4. **Start Infrastructure (PostgreSQL):**
   ```bash
   docker-compose up -d
   ```

5. **Initialize Database:**
   Wait for Docker to be ready, then run:
   ```bash
   # On Windows (PowerShell):
   Get-Content src/migrations/001_initial_schema.sql -Raw | docker exec -i bus_management_db psql -U postgres -d bus_management
   Get-Content src/migrations/002_seed_data.sql -Raw | docker exec -i bus_management_db psql -U postgres -d bus_management
   ```

6. **Start the Backend Server:**
   ```bash
   npm run dev
   ```

---

## 💻 Frontend Setup

1. **Navigate to the Frontend directory:**
   ```bash
   cd Frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Frontend App:**
   ```bash
   npm start
   ```
   Open [http://localhost:4200](http://localhost:4200) in your browser.

---

## 🔑 Default Credentials
- **Username:** `admin`
- **Password:** `admin123`

## 🛠️ Maintenance & Reset
- **Clean Reset:** To wipe and re-seed data, run the commands in Step 5 again.
- **Port Conflicts:** If port `3000` or `4200` is taken, update `.env` or `proxy.conf.json` accordingly.
