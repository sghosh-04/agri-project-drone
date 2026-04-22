import { NextResponse } from 'next/server'

/**
 * /api/field-detect
 * -----------------
 * Proxy for the Python field boundary detection backend (port 8002).
 */

const BOUNDARY_BACKEND_URL = process.env.BOUNDARY_BACKEND_URL || 'http://localhost:8002'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { image_base64 } = body

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 })
    }

    const pythonResponse = await fetch(`${BOUNDARY_BACKEND_URL}/detect-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64 }),
    })

    if (!pythonResponse.ok) {
      const errText = await pythonResponse.text()
      return NextResponse.json(
        { error: 'Boundary backend error', detail: errText },
        { status: pythonResponse.status }
      )
    }

    const result = await pythonResponse.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('field-detect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const res = await fetch(`${BOUNDARY_BACKEND_URL}/health`, { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    return NextResponse.json({ backend_status: 'online', ...data })
  } catch {
    return NextResponse.json(
      {
        backend_status: 'offline',
        message: `Boundary backend not reachable at ${BOUNDARY_BACKEND_URL}`,
      },
      { status: 503 }
    )
  }
}
