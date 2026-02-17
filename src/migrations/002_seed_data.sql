-- Seed data for Bus Management System
-- Creates 50 buses, 20 drivers, 10 routes, and 1 admin user

-- ================================
-- SEED ADMIN USER (password: admin123)
-- ================================
INSERT INTO admin_users (username, password_hash, email) VALUES
('admin', '$2a$10$5C9LpKV5ql8C5w5vh1xnV.mQ3fD5N.jf5YqJ3ZD8Q5N2c3Q5N5Q5N', 'admin@busmanagement.com'),
('harit', '$2a$10$eVTNmyru2gjRzH6e/POEY.TudtY869xbAYlb0P4N.BFTrRTn/S4Wy', 'harit@gmail.com');;

-- ================================
-- SEED 50 BUSES
-- ================================
INSERT INTO buses (bus_number, status) VALUES
('BUS-001', 'AVAILABLE'),
('BUS-002', 'AVAILABLE'),
('BUS-003', 'AVAILABLE'),
('BUS-004', 'AVAILABLE'),
('BUS-005', 'AVAILABLE'),
('BUS-006', 'AVAILABLE'),
('BUS-007', 'AVAILABLE'),
('BUS-008', 'AVAILABLE'),
('BUS-009', 'AVAILABLE'),
('BUS-010', 'AVAILABLE'),
('BUS-011', 'AVAILABLE'),
('BUS-012', 'AVAILABLE'),
('BUS-013', 'AVAILABLE'),
('BUS-014', 'AVAILABLE'),
('BUS-015', 'AVAILABLE'),
('BUS-016', 'AVAILABLE'),
('BUS-017', 'AVAILABLE'),
('BUS-018', 'AVAILABLE'),
('BUS-019', 'AVAILABLE'),
('BUS-020', 'AVAILABLE'),
('BUS-021', 'AVAILABLE'),
('BUS-022', 'AVAILABLE'),
('BUS-023', 'AVAILABLE'),
('BUS-024', 'AVAILABLE'),
('BUS-025', 'AVAILABLE'),
('BUS-026', 'AVAILABLE'),
('BUS-027', 'AVAILABLE'),
('BUS-028', 'AVAILABLE'),
('BUS-029', 'AVAILABLE'),
('BUS-030', 'AVAILABLE'),
('BUS-031', 'AVAILABLE'),
('BUS-032', 'AVAILABLE'),
('BUS-033', 'AVAILABLE'),
('BUS-034', 'AVAILABLE'),
('BUS-035', 'AVAILABLE'),
('BUS-036', 'AVAILABLE'),
('BUS-037', 'AVAILABLE'),
('BUS-038', 'AVAILABLE'),
('BUS-039', 'AVAILABLE'),
('BUS-040', 'AVAILABLE'),
('BUS-041', 'AVAILABLE'),
('BUS-042', 'AVAILABLE'),
('BUS-043', 'AVAILABLE'),
('BUS-044', 'AVAILABLE'),
('BUS-045', 'AVAILABLE'),
('BUS-046', 'AVAILABLE'),
('BUS-047', 'AVAILABLE'),
('BUS-048', 'AVAILABLE'),
('BUS-049', 'AVAILABLE'),
('BUS-050', 'AVAILABLE');

-- Set some buses in different statuses for testing
-- UPDATE buses SET status = 'MAINTENANCE' WHERE bus_number IN ('BUS-048', 'BUS-049');
-- UPDATE buses SET status = 'REST', rounds_today = 3 WHERE bus_number = 'BUS-050';

-- ================================
-- SEED 20 DRIVERS
-- ================================
INSERT INTO drivers (name, employee_id, license_number, status, phone) VALUES
('John Smith', 'DRV-001', 'DL-001234', 'AVAILABLE', '+1-555-0101'),
('Jane Doe', 'DRV-002', 'DL-002345', 'AVAILABLE', '+1-555-0102'),
('Michael Johnson', 'DRV-003', 'DL-003456', 'AVAILABLE', '+1-555-0103'),
('Emily Brown', 'DRV-004', 'DL-004567', 'AVAILABLE', '+1-555-0104'),
('David Wilson', 'DRV-005', 'DL-005678', 'AVAILABLE', '+1-555-0105'),
('Sarah Davis', 'DRV-006', 'DL-006789', 'AVAILABLE', '+1-555-0106'),
('James Miller', 'DRV-007', 'DL-007890', 'AVAILABLE', '+1-555-0107'),
('Lisa Anderson', 'DRV-008', 'DL-008901', 'AVAILABLE', '+1-555-0108'),
('Robert Taylor', 'DRV-009', 'DL-009012', 'AVAILABLE', '+1-555-0109'),
('Jennifer Thomas', 'DRV-010', 'DL-010123', 'AVAILABLE', '+1-555-0110'),
('William Jackson', 'DRV-011', 'DL-011234', 'AVAILABLE', '+1-555-0111'),
('Amanda White', 'DRV-012', 'DL-012345', 'AVAILABLE', '+1-555-0112'),
('Christopher Harris', 'DRV-013', 'DL-013456', 'AVAILABLE', '+1-555-0113'),
('Jessica Martin', 'DRV-014', 'DL-014567', 'AVAILABLE', '+1-555-0114'),
('Daniel Garcia', 'DRV-015', 'DL-015678', 'AVAILABLE', '+1-555-0115'),
('Ashley Martinez', 'DRV-016', 'DL-016789', 'AVAILABLE', '+1-555-0116'),
('Matthew Robinson', 'DRV-017', 'DL-017890', 'AVAILABLE', '+1-555-0117'),
('Nicole Clark', 'DRV-018', 'DL-018901', 'AVAILABLE', '+1-555-0118'),
('Joshua Rodriguez', 'DRV-019', 'DL-019012', 'AVAILABLE', '+1-555-0119'),
('Stephanie Lewis', 'DRV-020', 'DL-020123', 'AVAILABLE', '+1-555-0120');

-- Set one driver as OFF_DUTY for testing
-- UPDATE drivers SET status = 'OFF_DUTY', worked_minutes_today = 480 WHERE employee_id = 'DRV-020';

-- ================================
-- SEED 10 ROUTES
-- ================================
INSERT INTO routes (name, start_point, end_point, duration_minutes, status) VALUES
('Downtown Express', 'Central Station', 'Downtown Mall', 5, 'ACTIVE'),
('Airport Shuttle', 'City Center', 'International Airport', 7, 'ACTIVE'),
('University Line', 'North Terminal', 'State University', 3, 'ACTIVE'),
('Industrial Route', 'East Hub', 'Industrial Park', 5, 'ACTIVE'),
('Coastal Drive', 'Harbor Point', 'Beach Resort', 10, 'ACTIVE'),
('Suburban Connect', 'Metro Station', 'Suburban Plaza', 8, 'ACTIVE'),
('Hospital Express', 'Central Station', 'Medical Center', 20, 'ACTIVE'),
('Shopping Circuit', 'West Terminal', 'Shopping District', 3, 'ACTIVE'),
('Stadium Route', 'Sports Complex', 'City Stadium', 9, 'ACTIVE'),
('Night Service', 'Downtown', 'Residential Area', 11, 'ACTIVE');

-- ================================
-- VERIFICATION QUERY
-- ================================
-- Run these to verify the seed data:
-- SELECT COUNT(*) as bus_count FROM buses;
-- SELECT COUNT(*) as driver_count FROM drivers;
-- SELECT COUNT(*) as route_count FROM routes;
-- SELECT status, COUNT(*) FROM buses GROUP BY status;
-- SELECT status, COUNT(*) FROM drivers GROUP BY status;
-- SELECT status, COUNT(*) FROM routes GROUP BY status;
