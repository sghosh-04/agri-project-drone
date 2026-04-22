import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL!)

export type Drone = {
  id: number
  name: string
  model: string
  serial_number: string
  status: 'idle' | 'flying' | 'charging' | 'maintenance' | 'offline'
  battery_level: number
  max_flight_time: number
  max_speed: number
  current_lat: number | null
  current_lng: number | null
  current_altitude: number | null
  home_lat: number | null
  home_lng: number | null
  last_maintenance: string | null
  created_at: string
  updated_at: string
}

export type Field = {
  id: number
  name: string
  description: string | null
  area_hectares: number
  crop_type: string
  boundary_coords: Array<{ lat: number; lng: number }>
  center_lat: number
  center_lng: number
  soil_type: string | null
  irrigation_type: string | null
  planting_date: string | null
  expected_harvest: string | null
  created_at: string
  updated_at: string
}

export type Flight = {
  id: number
  drone_id: number
  field_id: number | null
  mission_type: string
  status: 'planned' | 'in_progress' | 'completed' | 'aborted' | 'failed'
  start_time: string | null
  end_time: string | null
  flight_path: Array<{ lat: number; lng: number; altitude: number }> | null
  distance_km: number | null
  max_altitude: number | null
  avg_speed: number | null
  battery_used: number | null
  weather_conditions: {
    temperature: number
    humidity: number
    wind_speed: number
    conditions: string
  } | null
  notes: string | null
  created_at: string
  drone_name?: string
  field_name?: string
}

export type SensorData = {
  id: number
  flight_id: number
  drone_id: number
  timestamp: string
  lat: number
  lng: number
  altitude: number
  temperature: number | null
  humidity: number | null
  soil_moisture: number | null
  ndvi: number | null
  battery_level: number | null
  signal_strength: number | null
}

export type PlantDetection = {
  id: number
  flight_id: number
  sensor_data_id: number | null
  detection_time: string
  lat: number
  lng: number
  plant_type: string
  disease_name: string
  confidence: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  affected_area_sqm: number | null
  image_url: string | null
  recommendations: string | null
  status: 'detected' | 'confirmed' | 'treated' | 'resolved' | 'false_positive'
}

export type Alert = {
  id: number
  drone_id: number | null
  flight_id: number | null
  field_id: number | null
  alert_type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string | null
  lat: number | null
  lng: number | null
  is_read: boolean
  is_resolved: boolean
  created_at: string
  resolved_at: string | null
  drone_name?: string
  field_name?: string
}

export type Mission = {
  id: number
  name: string
  description: string | null
  field_id: number | null
  drone_id: number | null
  mission_type: 'survey' | 'spray' | 'monitor' | 'mapping' | 'inspection'
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_start: string | null
  scheduled_end: string | null
  waypoints: Array<{ lat: number; lng: number; altitude: number }> | null
  parameters: Record<string, unknown> | null
  repeat_interval: string | null
  created_at: string
  updated_at: string
  drone_name?: string
  field_name?: string
}

export type DashboardStats = {
  drones: {
    total: number
    flying: number
    idle: number
    charging: number
    maintenance: number
    offline: number
    avg_battery: number
  }
  fields: {
    total: number
    total_area: number
    crop_types: number
  }
  flights: {
    total: number
    in_progress: number
    completed: number
    planned: number
    total_distance: number
  }
  alerts: {
    total: number
    unread: number
    critical_unresolved: number
    warning_unresolved: number
  }
  detections: {
    total: number
    detected: number
    high_severity: number
    unique_diseases: number
  }
  sensorAverages: {
    avg_temp: number
    avg_humidity: number
    avg_soil_moisture: number
    avg_ndvi: number
  }
}
