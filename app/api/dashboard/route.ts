import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const [
      droneStats,
      fieldStats,
      flightStats,
      alertStats,
      detectionStats,
      recentSensorData,
      missionStats
    ] = await Promise.all([
      sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'flying') as flying,
          COUNT(*) FILTER (WHERE status = 'idle') as idle,
          COUNT(*) FILTER (WHERE status = 'charging') as charging,
          COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
          COUNT(*) FILTER (WHERE status = 'offline') as offline,
          AVG(battery_level) as avg_battery
        FROM drones
      `,
      sql`
        SELECT 
          COUNT(*) as total,
          SUM(area_hectares) as total_area,
          COUNT(DISTINCT crop_type) as crop_types
        FROM fields
      `,
      sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'planned') as planned,
          SUM(distance_km) FILTER (WHERE status = 'completed') as total_distance
        FROM flights
      `,
      sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_read = false) as unread,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_unresolved,
          COUNT(*) FILTER (WHERE severity = 'warning') as warning_unresolved
        FROM alerts
      `,
      sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'detected') as detected,
          COUNT(*) FILTER (WHERE severity = 'high' OR severity = 'critical') as high_severity,
          COUNT(DISTINCT disease_type) as unique_diseases
        FROM plant_detections
      `,
      sql`
        SELECT 
          AVG(temperature) as avg_temp,
          AVG(humidity) as avg_humidity,
          AVG(soil_moisture) as avg_soil_moisture
        FROM sensor_data
        WHERE timestamp > NOW() - INTERVAL '24 hours'
      `,
      sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM missions
      `
    ])

    return NextResponse.json({
      drones: droneStats[0],
      fields: fieldStats[0],
      flights: flightStats[0],
      alerts: alertStats[0],
      detections: detectionStats[0],
      sensorAverages: recentSensorData[0],
      missions: missionStats[0]
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}
