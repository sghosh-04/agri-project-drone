import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const flights = await sql`
      SELECT f.*, d.name as drone_name, fi.name as field_name
      FROM flights f
      LEFT JOIN drones d ON f.drone_id = d.id
      LEFT JOIN fields fi ON f.field_id = fi.id
      ORDER BY f.created_at DESC
    `
    return NextResponse.json(flights)
  } catch (error) {
    console.error('Error fetching flights:', error)
    return NextResponse.json({ error: 'Failed to fetch flights' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { drone_id, field_id, mission_type, status, start_time, flight_path, notes } = body

    const result = await sql`
      INSERT INTO flights (drone_id, field_id, mission_type, status, start_time, flight_path, notes)
      VALUES (${drone_id}, ${field_id}, ${mission_type}, ${status || 'planned'}, ${start_time}, ${flight_path ? JSON.stringify(flight_path) : null}, ${notes})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating flight:', error)
    return NextResponse.json({ error: 'Failed to create flight' }, { status: 500 })
  }
}
