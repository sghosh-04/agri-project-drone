import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const drones = await sql`SELECT * FROM drones ORDER BY id`
    return NextResponse.json(drones)
  } catch (error) {
    console.error('Error fetching drones:', error)
    return NextResponse.json({ error: 'Failed to fetch drones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, model, serial_number, status, battery_level, max_flight_time, max_speed, current_lat, current_lng, home_lat, home_lng } = body

    const result = await sql`
      INSERT INTO drones (name, model, serial_number, status, battery_level, max_flight_time, max_speed, current_lat, current_lng, home_lat, home_lng)
      VALUES (${name}, ${model}, ${serial_number}, ${status || 'idle'}, ${battery_level || 100}, ${max_flight_time || 30}, ${max_speed || 15.0}, ${current_lat}, ${current_lng}, ${home_lat}, ${home_lng})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating drone:', error)
    return NextResponse.json({ error: 'Failed to create drone' }, { status: 500 })
  }
}
