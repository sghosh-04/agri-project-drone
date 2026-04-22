import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'

// Disease classes from the PlantDiseaseCNN model (38 classes)
const DISEASE_CLASSES = [
  'Apple___Apple_scab',
  'Apple___Black_rot',
  'Apple___Cedar_apple_rust',
  'Apple___healthy',
  'Blueberry___healthy',
  'Cherry_(including_sour)___Powdery_mildew',
  'Cherry_(including_sour)___healthy',
  'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
  'Corn_(maize)___Common_rust_',
  'Corn_(maize)___Northern_Leaf_Blight',
  'Corn_(maize)___healthy',
  'Grape___Black_rot',
  'Grape___Esca_(Black_Measles)',
  'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
  'Grape___healthy',
  'Orange___Haunglongbing_(Citrus_greening)',
  'Peach___Bacterial_spot',
  'Peach___healthy',
  'Pepper,_bell___Bacterial_spot',
  'Pepper,_bell___healthy',
  'Potato___Early_blight',
  'Potato___Late_blight',
  'Potato___healthy',
  'Raspberry___healthy',
  'Rice___Bacterial_leaf_blight',
  'Rice___Brown_spot',
  'Rice___Leaf_smut',
  'Soybean___healthy',
  'Squash___Powdery_mildew',
  'Strawberry___Leaf_scorch',
  'Strawberry___healthy',
  'Tomato___Bacterial_spot',
  'Tomato___Early_blight',
  'Tomato___Late_blight',
  'Tomato___Leaf_Mold',
  'Tomato___Septoria_leaf_spot',
  'Tomato___Spider_mites Two-spotted_spider_mite',
  'Tomato___Target_Spot',
  'Tomato___Tomato_Yellow_Leaf_Curl_Virus',
  'Tomato___Tomato_mosaic_virus',
  'Tomato___healthy',
]

// Treatment recommendations for each disease
const RECOMMENDATIONS: Record<string, string> = {
  'Apple___Apple_scab': 'Apply fungicide during early season. Remove infected leaves. Improve air circulation.',
  'Apple___Black_rot': 'Prune infected branches. Apply copper fungicide. Remove mummified fruits.',
  'Apple___Cedar_apple_rust': 'Apply fungicide in spring. Remove nearby juniper trees if possible.',
  'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': 'Apply fungicide. Use resistant varieties. Improve field drainage.',
  'Corn_(maize)___Common_rust_': 'Apply fungicide when symptoms appear. Plant resistant hybrids.',
  'Corn_(maize)___Northern_Leaf_Blight': 'Use resistant varieties. Apply foliar fungicides. Rotate crops.',
  'Rice___Bacterial_leaf_blight': 'Apply copper-based bactericide. Improve field drainage. Use resistant varieties.',
  'Rice___Brown_spot': 'Apply fungicide. Ensure proper nutrition. Use clean seeds.',
  'Rice___Leaf_smut': 'Use certified disease-free seeds. Apply fungicide seed treatment.',
  'Tomato___Bacterial_spot': 'Apply copper bactericide. Avoid overhead irrigation. Remove infected plants.',
  'Tomato___Early_blight': 'Apply fungicide preventively. Remove infected leaves. Mulch around plants.',
  'Tomato___Late_blight': 'Apply fungicide immediately. Remove infected plants. Improve air circulation.',
  'Tomato___Septoria_leaf_spot': 'Apply fungicide. Remove infected leaves. Avoid overhead watering.',
  'Tomato___Target_Spot': 'Apply fungicide. Remove infected plant debris. Use drip irrigation.',
  'Potato___Early_blight': 'Apply fungicide. Maintain proper nutrition. Remove infected leaves.',
  'Potato___Late_blight': 'Apply fungicide immediately. Destroy infected plants. Avoid overhead irrigation.',
  'Grape___Black_rot': 'Remove mummified berries. Apply fungicide before bloom. Prune for air circulation.',
  'Pepper,_bell___Bacterial_spot': 'Apply copper bactericide. Use disease-free seeds. Rotate crops.',
}

// Determine severity based on confidence and disease type
function determineSeverity(confidence: number, diseaseClass: string): 'low' | 'medium' | 'high' | 'critical' {
  const isHealthy = diseaseClass.includes('healthy')
  if (isHealthy) return 'low'
  
  if (confidence >= 0.9) return 'critical'
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.7) return 'medium'
  return 'low'
}

// Parse disease class to get plant type and disease name
function parseDiseaseClass(diseaseClass: string): { plantType: string; diseaseName: string } {
  const parts = diseaseClass.split('___')
  const plantType = parts[0].replace(/_/g, ' ').replace(/,/g, '')
  let diseaseName = parts[1] || 'Unknown'
  diseaseName = diseaseName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  
  if (diseaseName === 'healthy') {
    diseaseName = 'Healthy'
  }
  
  return { plantType, diseaseName }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      flight_id,
      sensor_data_id,
      lat,
      lng,
      predicted_class_index,
      confidence,
      image_url,
    } = body

    // Validate input
    if (predicted_class_index === undefined || confidence === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: predicted_class_index and confidence' },
        { status: 400 }
      )
    }

    // Get disease class
    const diseaseClass = DISEASE_CLASSES[predicted_class_index] || 'Unknown'
    const { plantType, diseaseName } = parseDiseaseClass(diseaseClass)
    
    // Skip if healthy
    const isHealthy = diseaseClass.includes('healthy')
    if (isHealthy) {
      return NextResponse.json({
        status: 'healthy',
        message: 'No disease detected - plant appears healthy',
        plant_type: plantType,
        confidence: confidence,
      })
    }

    // Determine severity
    const severity = determineSeverity(confidence, diseaseClass)
    
    // Get recommendations
    const recommendations = RECOMMENDATIONS[diseaseClass] || 
      'Consult with an agricultural expert for treatment recommendations.'

    // Calculate estimated affected area (mock calculation based on confidence)
    const affectedAreaSqm = Math.round((confidence * 100) + Math.random() * 50)

    // Store detection in database
    const result = await sql`
      INSERT INTO plant_detections (
        flight_id, 
        sensor_data_id, 
        lat, 
        lng, 
        plant_type, 
        disease_name, 
        confidence, 
        severity, 
        affected_area_sqm, 
        image_url, 
        recommendations, 
        status
      )
      VALUES (
        ${flight_id || null}, 
        ${sensor_data_id || null}, 
        ${lat || null}, 
        ${lng || null}, 
        ${plantType}, 
        ${diseaseName}, 
        ${confidence}, 
        ${severity}, 
        ${affectedAreaSqm}, 
        ${image_url || null}, 
        ${recommendations}, 
        'detected'
      )
      RETURNING *
    `

    // Create alert for high/critical severity
    if (severity === 'high' || severity === 'critical') {
      await sql`
        INSERT INTO alerts (
          flight_id,
          alert_type,
          severity,
          title,
          message,
          lat,
          lng
        )
        VALUES (
          ${flight_id || null},
          'disease_detected',
          ${severity === 'critical' ? 'critical' : 'warning'},
          ${`${diseaseName} Detected in ${plantType}`},
          ${`Disease detected with ${(confidence * 100).toFixed(0)}% confidence. ${recommendations}`},
          ${lat || null},
          ${lng || null}
        )
      `
    }

    return NextResponse.json({
      status: 'detected',
      detection: result[0],
      disease_class: diseaseClass,
      plant_type: plantType,
      disease_name: diseaseName,
      severity: severity,
      confidence: confidence,
      recommendations: recommendations,
      affected_area_sqm: affectedAreaSqm,
    }, { status: 201 })

  } catch (error) {
    console.error('Error processing detection:', error)
    return NextResponse.json(
      { error: 'Failed to process detection' },
      { status: 500 }
    )
  }
}

// GET endpoint to list supported disease classes
export async function GET() {
  return NextResponse.json({
    model: 'PlantDiseaseCNN',
    total_classes: DISEASE_CLASSES.length,
    classes: DISEASE_CLASSES.map((cls, index) => ({
      index,
      class_name: cls,
      ...parseDiseaseClass(cls),
    })),
  })
}
