import { NextResponse } from 'next/server'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL

// GET detections (if supported)
export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/detect`, {
      method: 'GET',
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching detections:', error)
    return NextResponse.json({ error: 'Failed to fetch detections' }, { status: 500 })
  }
}

// POST detection (main use case)
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const res = await fetch(`${BACKEND}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating detection:', error)
    return NextResponse.json({ error: 'Failed to create detection' }, { status: 500 })
  }
}
