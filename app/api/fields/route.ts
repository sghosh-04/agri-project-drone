import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const fields = await sql`SELECT * FROM fields ORDER BY id`
    return NextResponse.json(fields)
  } catch (error) {
    console.error('Error fetching fields:', error)
    return NextResponse.json({ error: 'Failed to fetch fields' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, area_hectares, crop_type, boundary_coords, center_lat, center_lng, soil_type, planting_date, expected_harvest } = body

    const result = await sql`
      INSERT INTO fields (name, description, area_hectares, crop_type, boundary_geojson, center_latitude, center_longitude, soil_type, planting_date, expected_harvest_date)
      VALUES (${name}, ${description}, ${area_hectares}, ${crop_type}, ${JSON.stringify(boundary_coords || [])}, ${center_lat || null}, ${center_lng || null}, ${soil_type}, ${planting_date || null}, ${expected_harvest || null})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating field:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create field' }, { status: 500 })
  }
}
