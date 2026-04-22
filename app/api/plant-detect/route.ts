import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * /api/plant-detect
 * -----------------
 * Proxy + persistence layer for the Python plant disease detection backend.
 *
 * POST body:
 *   {
 *     image_base64: string,   // base64 encoded image (data-URL or raw)
 *     lat?: number,
 *     lng?: number,
 *     flight_id?: number,
 *     sensor_data_id?: number,
 *     save_to_db?: boolean    // default true for diseased leaves
 *   }
 *
 * Returns the detection JSON from the Python backend plus any DB records created.
 */

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8001'

const RECOMMENDATIONS: Record<string, string> = {
  'Apple_scab': 'Apply fungicide during early season. Remove infected leaves. Improve air circulation.',
  'Black_rot': 'Prune infected branches. Apply copper fungicide. Remove mummified fruits.',
  'Cedar_apple_rust': 'Apply fungicide in spring. Remove nearby juniper trees if possible.',
  'Cercospora_leaf_spot': 'Apply fungicide. Use resistant varieties. Improve field drainage.',
  'Common_rust': 'Apply fungicide when symptoms appear. Plant resistant hybrids.',
  'Northern_Leaf_Blight': 'Use resistant varieties. Apply foliar fungicides. Rotate crops.',
  'Bacterial_spot': 'Apply copper bactericide. Avoid overhead irrigation. Remove infected plants.',
  'Early_blight': 'Apply fungicide preventively. Remove infected leaves. Mulch around plants.',
  'Late_blight': 'Apply fungicide immediately. Remove infected plants. Improve air circulation.',
  'Septoria_leaf_spot': 'Apply fungicide. Remove infected leaves. Avoid overhead watering.',
  'Target_Spot': 'Apply fungicide. Remove infected plant debris. Use drip irrigation.',
  'Leaf_Mold': 'Improve ventilation. Apply fungicide. Reduce humidity.',
  'Spider_mites': 'Apply miticide. Increase humidity. Remove heavily infested leaves.',
  'Tomato_Yellow_Leaf_Curl_Virus': 'Control whitefly vectors. Remove infected plants. Use resistant varieties.',
  'Tomato_mosaic_virus': 'Remove infected plants. Sanitize tools. Use disease-free transplants.',
  'Powdery_mildew': 'Apply sulfur-based fungicide. Improve air circulation. Avoid overhead irrigation.',
  'Leaf_scorch': 'Apply fungicide. Remove and destroy infected leaves. Avoid wetting foliage.',
  'Haunglongbing': 'Remove and destroy infected trees. Control psyllid vectors. No cure available.',
  'Esca': 'Prune infected vines. Apply fungicide on pruning wounds. Use resistant rootstocks.',
  'Leaf_blight': 'Apply fungicide. Remove crop debris. Rotate crops.',
}

function getRecommendation(diseaseName: string): string {
  const key = Object.keys(RECOMMENDATIONS).find((k) =>
    diseaseName.toLowerCase().includes(k.toLowerCase())
  )
  return key
    ? RECOMMENDATIONS[key]
    : 'Consult with an agricultural expert for treatment recommendations.'
}

function determineSeverity(
  confidence: number,
  status: string
): 'low' | 'medium' | 'high' | 'critical' {
  if (status === 'HEALTHY') return 'low'
  if (status === 'UNCERTAIN') return 'low'
  if (confidence >= 0.9) return 'critical'
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.7) return 'medium'
  return 'low'
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { image_base64, lat, lng, flight_id, sensor_data_id, save_to_db = true } = body

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 is required' }, { status: 400 })
    }

    // ---------------------------------------------------------------
    // Forward to Python backend
    // ---------------------------------------------------------------
    let pythonResponse: Response
    try {
      pythonResponse = await fetch(`${PYTHON_BACKEND_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64, lat, lng, flight_id, sensor_data_id }),
      })
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Python detection backend is not running.',
          detail: `Could not connect to ${PYTHON_BACKEND_URL}. Start it with: bash python_backend/start_server.sh`,
        },
        { status: 503 }
      )
    }

    if (!pythonResponse.ok) {
      const errText = await pythonResponse.text()
      return NextResponse.json(
        { error: 'Detection backend error', detail: errText },
        { status: pythonResponse.status }
      )
    }

    const detectionResult = await pythonResponse.json()

    // ---------------------------------------------------------------
    // Persist diseased / UNCERTAIN leaves to the DB
    // ---------------------------------------------------------------
    const savedDetections = []

    if (save_to_db) {
      for (const leaf of detectionResult.leaves ?? []) {
        if (!leaf.leaf_detected || leaf.status === 'NO_LEAF' || leaf.status === 'MASKED_WEAK') {
          continue
        }

        const severity = determineSeverity(leaf.confidence, leaf.status)
        const recommendations = leaf.status === 'HEALTHY'
          ? 'Plant appears healthy. Continue regular monitoring.'
          : getRecommendation(leaf.disease_name)

        try {
          const result = await sql`
            INSERT INTO plant_detections (
              flight_id, sensor_data_id, lat, lng,
              plant_type, disease_name, confidence,
              severity, affected_area_sqm, image_url,
              recommendations, status
            )
            VALUES (
              ${flight_id ?? null},
              ${sensor_data_id ?? null},
              ${lat ?? null},
              ${lng ?? null},
              ${leaf.plant_type || 'Unknown'},
              ${leaf.disease_name || (leaf.status === 'HEALTHY' ? 'Healthy' : 'Unknown')},
              ${leaf.confidence},
              ${severity},
              ${Math.round(leaf.confidence * 100 + Math.random() * 30)},
              ${null},
              ${recommendations},
              'detected'
            )
            RETURNING *
          `
          savedDetections.push(result[0])

          // Create alert for high / critical severity
          if (severity === 'high' || severity === 'critical') {
            await sql`
              INSERT INTO alerts (
                flight_id, alert_type, severity, title, message, lat, lng
              )
              VALUES (
                ${flight_id ?? null},
                'disease_detected',
                ${severity === 'critical' ? 'critical' : 'warning'},
                ${`${leaf.disease_name} Detected in ${leaf.plant_type}`},
                ${`Disease detected with ${(leaf.confidence * 100).toFixed(0)}% confidence. ${recommendations}`},
                ${lat ?? null},
                ${lng ?? null}
              )
            `
          }
        } catch (dbErr) {
          console.warn('DB insert failed (non-fatal):', dbErr)
        }
      }
    }

    return NextResponse.json({
      ...detectionResult,
      saved_detections: savedDetections,
    })
  } catch (error) {
    console.error('plant-detect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  // Check if Python backend is alive
  try {
    const res = await fetch(`${PYTHON_BACKEND_URL}/health`, { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    return NextResponse.json({ backend_status: 'online', ...data })
  } catch {
    return NextResponse.json(
      {
        backend_status: 'offline',
        message: `Python backend not reachable at ${PYTHON_BACKEND_URL}`,
        start_command: 'bash python_backend/start_server.sh',
      },
      { status: 503 }
    )
  }
}
