import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const alerts = await sql`
      SELECT a.*, d.name as drone_name, f.name as field_name
      FROM alerts a
      LEFT JOIN drones d ON a.drone_id = d.id
      LEFT JOIN fields f ON a.field_id = f.id
      ORDER BY a.created_at DESC
    `
    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { drone_id, flight_id, field_id, alert_type, severity, title, message, lat, lng } = body

    const result = await sql`
      INSERT INTO alerts (drone_id, flight_id, field_id, alert_type, severity, title, message, lat, lng)
      VALUES (${drone_id}, ${flight_id}, ${field_id}, ${alert_type}, ${severity || 'info'}, ${title}, ${message}, ${lat}, ${lng})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating alert:', error)
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, is_read, is_resolved } = body

    let result
    if (is_resolved !== undefined) {
      result = await sql`
        UPDATE alerts
        SET is_resolved = ${is_resolved}, resolved_at = ${is_resolved ? new Date().toISOString() : null}
        WHERE id = ${id}
        RETURNING *
      `
    } else {
      result = await sql`
        UPDATE alerts
        SET is_read = ${is_read}
        WHERE id = ${id}
        RETURNING *
      `
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
