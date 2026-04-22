import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const missions = await sql`
      SELECT m.*, d.name as drone_name, f.name as field_name
      FROM missions m
      LEFT JOIN drones d ON m.drone_id = d.id
      LEFT JOIN fields f ON m.field_id = f.id
      ORDER BY m.scheduled_start DESC NULLS LAST, m.created_at DESC
    `
    return NextResponse.json(missions)
  } catch (error) {
    console.error('Error fetching missions:', error)
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, field_id, drone_id, mission_type, status, scheduled_start, scheduled_end, waypoints, parameters, repeat_interval } = body

    const result = await sql`
      INSERT INTO missions (name, description, field_id, drone_id, mission_type, status, scheduled_start, scheduled_end, waypoints_geojson, parameters, repeat_schedule)
      VALUES (${name}, ${description}, ${field_id || null}, ${drone_id || null}, ${mission_type}, ${status || 'draft'}, ${scheduled_start || null}, ${scheduled_end || null}, ${waypoints ? JSON.stringify(waypoints) : null}, ${parameters ? JSON.stringify(parameters) : null}, ${repeat_interval || null})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Error creating mission:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create mission' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, drone_id, scheduled_start, scheduled_end } = body

    const result = await sql`
      UPDATE missions
      SET 
        status = COALESCE(${status}, status),
        drone_id = COALESCE(${drone_id}, drone_id),
        scheduled_start = COALESCE(${scheduled_start}, scheduled_start),
        scheduled_end = COALESCE(${scheduled_end}, scheduled_end),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating mission:', error)
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 })
  }
}
