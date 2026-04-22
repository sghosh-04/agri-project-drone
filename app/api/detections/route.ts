import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const detections = await sql`
      SELECT pd.*, f.name as field_name, d.name as drone_name
      FROM plant_detections pd
      LEFT JOIN flights fl ON pd.flight_id = fl.id
      LEFT JOIN fields f ON fl.field_id = f.id
      LEFT JOIN drones d ON fl.drone_id = d.id
      ORDER BY pd.detection_time DESC
    `
    return NextResponse.json(detections)
  } catch (error) {
    console.error('Error fetching detections:', error)
    return NextResponse.json({ error: 'Failed to fetch detections' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { flight_id, sensor_data_id, lat, lng, plant_type, disease_name, confidence, severity, affected_area_sqm, image_url, recommendations, status } = body

    const result = await sql`
      INSERT INTO plant_detections (flight_id, sensor_data_id, lat, lng, plant_type, disease_name, confidence, severity, affected_area_sqm, image_url, recommendations, status)
      VALUES (${flight_id}, ${sensor_data_id}, ${lat}, ${lng}, ${plant_type}, ${disease_name}, ${confidence}, ${severity || 'medium'}, ${affected_area_sqm}, ${image_url}, ${recommendations}, ${status || 'detected'})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating detection:', error)
    return NextResponse.json({ error: 'Failed to create detection' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status } = body

    const result = await sql`
      UPDATE plant_detections
      SET status = ${status}
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating detection:', error)
    return NextResponse.json({ error: 'Failed to update detection' }, { status: 500 })
  }
}
