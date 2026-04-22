-- Agricultural Drone Monitoring System Database Schema
-- This script creates all necessary tables for the agricultural drone monitoring platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drones table - stores information about each drone in the fleet
CREATE TABLE IF NOT EXISTS drones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('idle', 'flying', 'charging', 'maintenance', 'offline')),
    battery_level INTEGER DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
    last_latitude DECIMAL(10, 8),
    last_longitude DECIMAL(11, 8),
    last_altitude DECIMAL(8, 2),
    firmware_version VARCHAR(50),
    total_flight_hours DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fields table - stores information about agricultural fields being monitored
CREATE TABLE IF NOT EXISTS fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    area_hectares DECIMAL(10, 2),
    crop_type VARCHAR(100),
    soil_type VARCHAR(100),
    center_latitude DECIMAL(10, 8) NOT NULL,
    center_longitude DECIMAL(11, 8) NOT NULL,
    boundary_geojson JSONB,
    planting_date DATE,
    expected_harvest_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flights table - records each drone flight/mission
CREATE TABLE IF NOT EXISTS flights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id UUID REFERENCES drones(id) ON DELETE CASCADE,
    field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
    mission_type VARCHAR(50) NOT NULL CHECK (mission_type IN ('survey', 'monitoring', 'spraying', 'seeding', 'mapping', 'inspection')),
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'aborted', 'failed')),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    planned_start_time TIMESTAMP WITH TIME ZONE,
    flight_path_geojson JSONB,
    altitude_meters DECIMAL(8, 2),
    speed_ms DECIMAL(6, 2),
    area_covered_hectares DECIMAL(10, 2),
    battery_used INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sensor data table - stores telemetry and sensor readings from drones
CREATE TABLE IF NOT EXISTS sensor_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
    drone_id UUID REFERENCES drones(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    altitude DECIMAL(8, 2),
    speed DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    soil_moisture DECIMAL(5, 2),
    ndvi_value DECIMAL(4, 3),
    battery_level INTEGER,
    signal_strength INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plant detections table - stores AI detection results for plant diseases
CREATE TABLE IF NOT EXISTS plant_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
    field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
    detection_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    disease_type VARCHAR(100) NOT NULL,
    confidence DECIMAL(5, 4) CHECK (confidence >= 0 AND confidence <= 1),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_area_sqm DECIMAL(10, 2),
    image_url TEXT,
    recommendation TEXT,
    status VARCHAR(20) DEFAULT 'detected' CHECK (status IN ('detected', 'confirmed', 'treated', 'resolved', 'false_positive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts table - stores system alerts and notifications
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id UUID REFERENCES drones(id) ON DELETE CASCADE,
    field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
    flight_id UUID REFERENCES flights(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('battery_low', 'disease_detected', 'maintenance_due', 'weather_warning', 'geofence_breach', 'signal_lost', 'mission_complete', 'system_error')),
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    title VARCHAR(200) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Missions table - stores planned missions/schedules
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    drone_id UUID REFERENCES drones(id) ON DELETE SET NULL,
    field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
    mission_type VARCHAR(50) NOT NULL CHECK (mission_type IN ('survey', 'monitoring', 'spraying', 'seeding', 'mapping', 'inspection')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    waypoints_geojson JSONB,
    parameters JSONB,
    repeat_schedule VARCHAR(50) CHECK (repeat_schedule IN ('once', 'daily', 'weekly', 'monthly', NULL)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_flights_drone_id ON flights(drone_id);
CREATE INDEX IF NOT EXISTS idx_flights_field_id ON flights(field_id);
CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status);
CREATE INDEX IF NOT EXISTS idx_sensor_data_flight_id ON sensor_data(flight_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_plant_detections_field_id ON plant_detections(field_id);
CREATE INDEX IF NOT EXISTS idx_plant_detections_disease_type ON plant_detections(disease_type);
CREATE INDEX IF NOT EXISTS idx_alerts_drone_id ON alerts(drone_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_scheduled_start ON missions(scheduled_start);
