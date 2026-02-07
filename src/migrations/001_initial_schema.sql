-- Bus Management System Database Schema
-- Run this migration to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- ADMIN USERS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- BUSES TABLE
-- ================================
CREATE TYPE bus_status AS ENUM ('AVAILABLE', 'RUNNING', 'REST', 'MAINTENANCE');

CREATE TABLE IF NOT EXISTS buses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_number VARCHAR(20) UNIQUE NOT NULL,
    status bus_status DEFAULT 'AVAILABLE',
    rounds_today INTEGER DEFAULT 0,
    last_round_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for status queries
CREATE INDEX idx_buses_status ON buses(status);

-- ================================
-- DRIVERS TABLE
-- ================================
CREATE TYPE driver_status AS ENUM ('AVAILABLE', 'RUNNING', 'OFF_DUTY');

CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    license_number VARCHAR(50),
    status driver_status DEFAULT 'AVAILABLE',
    worked_minutes_today INTEGER DEFAULT 0,
    last_work_reset_date DATE DEFAULT CURRENT_DATE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for status queries
CREATE INDEX idx_drivers_status ON drivers(status);

-- ================================
-- ROUTES TABLE
-- ================================
CREATE TYPE route_status AS ENUM ('ACTIVE', 'COMPLETED');

CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    start_point VARCHAR(255),
    end_point VARCHAR(255),
    duration_minutes INTEGER NOT NULL,
    status route_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for status queries
CREATE INDEX idx_routes_status ON routes(status);

-- ================================
-- ROUTE ASSIGNMENTS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS route_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    bus_id UUID REFERENCES buses(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    is_forced BOOLEAN DEFAULT FALSE,
    forced_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    round_number INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for queries
CREATE INDEX idx_route_assignments_route ON route_assignments(route_id);
CREATE INDEX idx_route_assignments_bus ON route_assignments(bus_id);
CREATE INDEX idx_route_assignments_driver ON route_assignments(driver_id);
CREATE INDEX idx_route_assignments_active ON route_assignments(is_active);

-- ================================
-- BUS ACTIVITY LOGS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS bus_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    previous_status bus_status,
    new_status bus_status,
    related_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    related_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    is_admin_forced BOOLEAN DEFAULT FALSE,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for queries
CREATE INDEX idx_bus_activity_bus ON bus_activity_logs(bus_id);
CREATE INDEX idx_bus_activity_timestamp ON bus_activity_logs(timestamp);

-- ================================
-- DRIVER ACTIVITY LOGS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS driver_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    previous_status driver_status,
    new_status driver_status,
    related_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    related_bus_id UUID REFERENCES buses(id) ON DELETE SET NULL,
    is_admin_forced BOOLEAN DEFAULT FALSE,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for queries
CREATE INDEX idx_driver_activity_driver ON driver_activity_logs(driver_id);
CREATE INDEX idx_driver_activity_timestamp ON driver_activity_logs(timestamp);

-- ================================
-- ROUTE ACTIVITY LOGS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS route_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    previous_status route_status,
    new_status route_status,
    related_bus_id UUID REFERENCES buses(id) ON DELETE SET NULL,
    related_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    is_admin_forced BOOLEAN DEFAULT FALSE,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for queries
CREATE INDEX idx_route_activity_route ON route_activity_logs(route_id);
CREATE INDEX idx_route_activity_timestamp ON route_activity_logs(timestamp);

-- ================================
-- FUNCTION: Reset daily counters
-- ================================
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void AS $$
BEGIN
    -- Reset bus rounds for new day
    UPDATE buses 
    SET rounds_today = 0, last_round_reset_date = CURRENT_DATE
    WHERE last_round_reset_date < CURRENT_DATE;
    
    -- Reset driver work minutes for new day
    UPDATE drivers 
    SET worked_minutes_today = 0, last_work_reset_date = CURRENT_DATE
    WHERE last_work_reset_date < CURRENT_DATE;
    
    -- Reset driver and bus statuses if they were REST/OFF_DUTY from previous day
    UPDATE buses 
    SET status = 'AVAILABLE' 
    WHERE status = 'REST' AND last_round_reset_date < CURRENT_DATE;
    
    UPDATE drivers 
    SET status = 'AVAILABLE' 
    WHERE status = 'OFF_DUTY' AND last_work_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- TRIGGER: Update timestamp on record update
-- ================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_buses_updated_at
    BEFORE UPDATE ON buses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_routes_updated_at
    BEFORE UPDATE ON routes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_route_assignments_updated_at
    BEFORE UPDATE ON route_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
