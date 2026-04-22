-- Seed data for Agricultural Drone Monitoring System
-- This script populates the database with realistic mock data for development

-- Insert sample drones
INSERT INTO drones (id, name, model, serial_number, status, battery_level, last_latitude, last_longitude, last_altitude, firmware_version, total_flight_hours)
VALUES
    ('d1a2b3c4-5678-9abc-def0-123456789001', 'AgriDrone Alpha', 'DJI Agras T40', 'DJI-T40-2024-001', 'flying', 78, 14.5995, 120.9842, 50.0, 'v2.4.1', 245.5),
    ('d1a2b3c4-5678-9abc-def0-123456789002', 'AgriDrone Beta', 'DJI Agras T40', 'DJI-T40-2024-002', 'idle', 95, 14.6012, 120.9856, 0.0, 'v2.4.1', 189.3),
    ('d1a2b3c4-5678-9abc-def0-123456789003', 'AgriDrone Gamma', 'DJI Mavic 3M', 'DJI-M3M-2024-001', 'charging', 45, 14.5978, 120.9831, 0.0, 'v1.8.2', 312.7),
    ('d1a2b3c4-5678-9abc-def0-123456789004', 'AgriDrone Delta', 'DJI Mavic 3M', 'DJI-M3M-2024-002', 'maintenance', 100, 14.6005, 120.9845, 0.0, 'v1.8.2', 156.2),
    ('d1a2b3c4-5678-9abc-def0-123456789005', 'AgriDrone Epsilon', 'DJI Agras T20P', 'DJI-T20P-2024-001', 'idle', 88, 14.5989, 120.9838, 0.0, 'v3.1.0', 98.4)
ON CONFLICT (serial_number) DO NOTHING;

-- Insert sample fields
INSERT INTO fields (id, name, description, area_hectares, crop_type, soil_type, center_latitude, center_longitude, planting_date, expected_harvest_date)
VALUES
    ('f1a2b3c4-5678-9abc-def0-123456789001', 'North Rice Paddy', 'Primary rice cultivation area with irrigation system', 25.5, 'Rice', 'Clay Loam', 14.6015, 120.9850, '2025-11-15', '2026-04-15'),
    ('f1a2b3c4-5678-9abc-def0-123456789002', 'South Corn Field', 'Corn cultivation with drip irrigation', 18.2, 'Corn', 'Sandy Loam', 14.5970, 120.9820, '2025-12-01', '2026-03-30'),
    ('f1a2b3c4-5678-9abc-def0-123456789003', 'East Vegetable Garden', 'Mixed vegetable cultivation', 8.7, 'Mixed Vegetables', 'Loam', 14.5995, 120.9880, '2026-01-10', '2026-04-10'),
    ('f1a2b3c4-5678-9abc-def0-123456789004', 'West Sugarcane Plot', 'Sugarcane plantation', 32.0, 'Sugarcane', 'Clay', 14.6000, 120.9780, '2025-09-01', '2026-08-30'),
    ('f1a2b3c4-5678-9abc-def0-123456789005', 'Central Orchard', 'Mango and coconut trees', 12.3, 'Fruit Trees', 'Sandy Clay Loam', 14.5985, 120.9840, '2023-06-15', NULL)
ON CONFLICT DO NOTHING;

-- Insert sample flights
INSERT INTO flights (id, drone_id, field_id, mission_type, status, start_time, end_time, altitude_meters, speed_ms, area_covered_hectares, battery_used)
VALUES
    ('fl1a2b3c4-5678-9abc-def0-12345678901', 'd1a2b3c4-5678-9abc-def0-123456789001', 'f1a2b3c4-5678-9abc-def0-123456789001', 'monitoring', 'in_progress', NOW() - INTERVAL '25 minutes', NULL, 50.0, 8.5, 12.5, 22),
    ('fl1a2b3c4-5678-9abc-def0-12345678902', 'd1a2b3c4-5678-9abc-def0-123456789002', 'f1a2b3c4-5678-9abc-def0-123456789002', 'survey', 'completed', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 45.0, 10.0, 18.2, 35),
    ('fl1a2b3c4-5678-9abc-def0-12345678903', 'd1a2b3c4-5678-9abc-def0-123456789003', 'f1a2b3c4-5678-9abc-def0-123456789003', 'mapping', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', 60.0, 6.0, 8.7, 55),
    ('fl1a2b3c4-5678-9abc-def0-12345678904', 'd1a2b3c4-5678-9abc-def0-123456789001', 'f1a2b3c4-5678-9abc-def0-123456789004', 'spraying', 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '47 hours', 15.0, 5.0, 32.0, 68),
    ('fl1a2b3c4-5678-9abc-def0-12345678905', 'd1a2b3c4-5678-9abc-def0-123456789005', 'f1a2b3c4-5678-9abc-def0-123456789001', 'inspection', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '71 hours', 30.0, 12.0, 25.5, 28)
ON CONFLICT DO NOTHING;

-- Insert sample sensor data for the current flight
INSERT INTO sensor_data (flight_id, drone_id, timestamp, latitude, longitude, altitude, speed, heading, temperature, humidity, soil_moisture, ndvi_value, battery_level, signal_strength)
SELECT
    'fl1a2b3c4-5678-9abc-def0-12345678901',
    'd1a2b3c4-5678-9abc-def0-123456789001',
    NOW() - (INTERVAL '1 minute' * generate_series(0, 24)),
    14.5995 + (random() * 0.005 - 0.0025),
    120.9842 + (random() * 0.005 - 0.0025),
    50.0 + (random() * 10 - 5),
    8.5 + (random() * 2 - 1),
    (random() * 360)::DECIMAL(5,2),
    28.0 + (random() * 4 - 2),
    75.0 + (random() * 10 - 5),
    45.0 + (random() * 20 - 10),
    0.65 + (random() * 0.2 - 0.1),
    78 - generate_series(0, 24),
    90 + (random() * 10)::INTEGER
ON CONFLICT DO NOTHING;

-- Insert sample plant detections
INSERT INTO plant_detections (id, flight_id, field_id, detection_time, latitude, longitude, disease_type, confidence, severity, affected_area_sqm, recommendation, status)
VALUES
    ('pd1a2b3c4-5678-9abc-def0-12345678901', 'fl1a2b3c4-5678-9abc-def0-12345678902', 'f1a2b3c4-5678-9abc-def0-123456789002', NOW() - INTERVAL '3 hours', 14.5972, 120.9825, 'Corn Common Rust', 0.89, 'medium', 150.5, 'Apply fungicide treatment within 48 hours. Consider Mancozeb or Propiconazole.', 'confirmed'),
    ('pd1a2b3c4-5678-9abc-def0-12345678902', 'fl1a2b3c4-5678-9abc-def0-12345678903', 'f1a2b3c4-5678-9abc-def0-123456789003', NOW() - INTERVAL '1 day', 14.5998, 120.9885, 'Tomato Early Blight', 0.94, 'high', 85.2, 'Immediate removal of affected leaves. Apply copper-based fungicide.', 'detected'),
    ('pd1a2b3c4-5678-9abc-def0-12345678903', 'fl1a2b3c4-5678-9abc-def0-12345678905', 'f1a2b3c4-5678-9abc-def0-123456789001', NOW() - INTERVAL '3 days', 14.6020, 120.9855, 'Rice Bacterial Leaf Blight', 0.78, 'low', 45.0, 'Monitor closely. Ensure proper water management and drainage.', 'treated'),
    ('pd1a2b3c4-5678-9abc-def0-12345678904', 'fl1a2b3c4-5678-9abc-def0-12345678902', 'f1a2b3c4-5678-9abc-def0-123456789002', NOW() - INTERVAL '2 hours', 14.5968, 120.9818, 'Corn Northern Leaf Blight', 0.82, 'medium', 220.0, 'Apply foliar fungicide. Consider resistant varieties for next season.', 'detected'),
    ('pd1a2b3c4-5678-9abc-def0-12345678905', 'fl1a2b3c4-5678-9abc-def0-12345678903', 'f1a2b3c4-5678-9abc-def0-123456789003', NOW() - INTERVAL '20 hours', 14.5992, 120.9878, 'Pepper Bacterial Spot', 0.91, 'critical', 65.8, 'Urgent: Remove infected plants. Apply copper hydroxide spray to surrounding plants.', 'detected')
ON CONFLICT DO NOTHING;

-- Insert sample alerts
INSERT INTO alerts (drone_id, field_id, flight_id, alert_type, severity, title, message, is_read)
VALUES
    ('d1a2b3c4-5678-9abc-def0-123456789003', NULL, NULL, 'battery_low', 'warning', 'Low Battery - AgriDrone Gamma', 'AgriDrone Gamma battery level is at 45%. Charging is recommended before next mission.', FALSE),
    (NULL, 'f1a2b3c4-5678-9abc-def0-123456789002', 'fl1a2b3c4-5678-9abc-def0-12345678902', 'disease_detected', 'critical', 'Disease Detected - South Corn Field', 'Corn Common Rust detected with 89% confidence in South Corn Field. Immediate action recommended.', FALSE),
    ('d1a2b3c4-5678-9abc-def0-123456789004', NULL, NULL, 'maintenance_due', 'info', 'Scheduled Maintenance - AgriDrone Delta', 'AgriDrone Delta is due for scheduled maintenance. Motor inspection and calibration required.', TRUE),
    (NULL, 'f1a2b3c4-5678-9abc-def0-123456789003', 'fl1a2b3c4-5678-9abc-def0-12345678903', 'disease_detected', 'critical', 'Critical Disease - East Vegetable Garden', 'Pepper Bacterial Spot detected with critical severity. Urgent treatment required.', FALSE),
    ('d1a2b3c4-5678-9abc-def0-123456789001', 'f1a2b3c4-5678-9abc-def0-123456789001', 'fl1a2b3c4-5678-9abc-def0-12345678901', 'mission_complete', 'info', 'Mission Progress Update', 'Current monitoring mission is 50% complete. All systems operating normally.', TRUE)
ON CONFLICT DO NOTHING;

-- Insert sample missions
INSERT INTO missions (id, name, description, drone_id, field_id, mission_type, status, scheduled_start, scheduled_end, repeat_schedule)
VALUES
    ('ms1a2b3c4-5678-9abc-def0-12345678901', 'Morning Field Survey', 'Daily morning survey of all fields for crop health assessment', 'd1a2b3c4-5678-9abc-def0-123456789002', 'f1a2b3c4-5678-9abc-def0-123456789001', 'survey', 'scheduled', NOW() + INTERVAL '1 day' + INTERVAL '6 hours', NOW() + INTERVAL '1 day' + INTERVAL '8 hours', 'daily'),
    ('ms1a2b3c4-5678-9abc-def0-12345678902', 'Corn Field Spraying', 'Fungicide application for corn rust treatment', 'd1a2b3c4-5678-9abc-def0-123456789001', 'f1a2b3c4-5678-9abc-def0-123456789002', 'spraying', 'scheduled', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '4 hours', 'once'),
    ('ms1a2b3c4-5678-9abc-def0-12345678903', 'Vegetable Garden Inspection', 'Detailed inspection following disease detection', 'd1a2b3c4-5678-9abc-def0-123456789005', 'f1a2b3c4-5678-9abc-def0-123456789003', 'inspection', 'draft', NOW() + INTERVAL '12 hours', NOW() + INTERVAL '14 hours', 'once'),
    ('ms1a2b3c4-5678-9abc-def0-12345678904', 'Weekly Mapping Update', 'Comprehensive field mapping for yield estimation', 'd1a2b3c4-5678-9abc-def0-123456789003', NULL, 'mapping', 'scheduled', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '6 hours', 'weekly'),
    ('ms1a2b3c4-5678-9abc-def0-12345678905', 'Sugarcane Monitoring', 'Regular monitoring of sugarcane growth progress', 'd1a2b3c4-5678-9abc-def0-123456789002', 'f1a2b3c4-5678-9abc-def0-123456789004', 'monitoring', 'scheduled', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '3 hours', 'weekly')
ON CONFLICT DO NOTHING;
