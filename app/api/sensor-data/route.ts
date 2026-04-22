import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const flightId = searchParams.get('flight_id')
    const droneId = searchParams.get('drone_id')
    const limit = searchParams.get('limit') || '100'

    let sensorData
    if (flightId) {
      sensorData = await sql`
        SELECT * FROM sensor_data 
        WHERE flight_id = ${parseInt(flightId)}
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `
    } else if (droneId) {
      sensorData = await sql`
        SELECT * FROM sensor_data 
        WHERE drone_id = ${parseInt(droneId)}
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `
    } else {
      sensorData = await sql`
        SELECT * FROM sensor_data 
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `
    }

    return NextResponse.json(sensorData)
  } catch (error) {
    console.error('Error fetching sensor data:', error)
    return NextResponse.json({ error: 'Failed to fetch sensor data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { flight_id, drone_id, lat, lng, altitude, temperature, humidity, soil_moisture, ndvi, battery_level, signal_strength } = body

    const result = await sql`
      INSERT INTO sensor_data (flight_id, drone_id, lat, lng, altitude, temperature, humidity, soil_moisture, ndvi, battery_level, signal_strength)
      VALUES (${flight_id}, ${drone_id}, ${lat}, ${lng}, ${altitude}, ${temperature}, ${humidity}, ${soil_moisture}, ${ndvi}, ${battery_level}, ${signal_strength})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating sensor data:', error)
    return NextResponse.json({ error: 'Failed to create sensor data' }, { status: 500 })
  }
}
