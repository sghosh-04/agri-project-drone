# AgriDrone: AI-Powered Agricultural Monitoring & Disease Detection Platform

> A comprehensive drone-based agricultural intelligence system combining real-time monitoring, AI-powered plant disease detection, and actionable farm management insights.

## 🌾 Overview

AgriDrone is an enterprise-grade agricultural technology platform that leverages autonomous drone fleets, advanced computer vision, and IoT sensors to provide farmers with real-time crop health monitoring and disease detection. The system integrates a modern Next.js dashboard with a Python-based AI backend for intelligent plant disease classification.

**Key Capabilities:**
- 🚁 Multi-drone fleet management and coordination
- 🤖 AI-powered plant disease detection (YOLO + CNN)
- 📊 Real-time environmental monitoring (temperature, humidity, soil moisture, NDVI)
- 🗺️ Interactive field mapping and boundary detection
- 🚨 Intelligent alert system with severity classification
- 📈 Comprehensive analytics and historical data tracking
- 🎯 Mission planning and automated flight execution

---

## 🏗️ Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     AgriDrone Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Frontend Layer (Next.js 16 + React 19)          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Dashboard | Drones | Fields | Missions | Analytics │  │  │
│  │  │ Live Detection | Boundary Detection | Map View     │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      API Layer (Next.js Route Handlers)                 │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ /api/drones | /api/fields | /api/flights          │  │  │
│  │  │ /api/missions | /api/alerts | /api/detections     │  │  │
│  │  │ /api/sensor-data | /api/plant-detect              │  │  │
│  │  │ /api/dashboard | /api/ai/detect                   │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Backend Services Layer                            │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Python FastAPI Server (Port 8001)                 │  │  │
│  │  │ ├─ Plant Disease Detection (YOLO + CNN)           │  │  │
│  │  │ ├─ Field Boundary Detection (DexiNed)             │  │  │
│  │  │ └─ Model Management & Inference                   │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Data Layer                                         │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Neon PostgreSQL Database                          │  │  │
│  │  │ ├─ Drones (fleet management)                      │  │  │
│  │  │ ├─ Fields (crop data & boundaries)                │  │  │
│  │  │ ├─ Flights (mission history)                      │  │  │
│  │  │ ├─ Missions (scheduled operations)                │  │  │
│  │  │ ├─ Sensor Data (environmental metrics)            │  │  │
│  │  │ ├─ Plant Detections (disease records)             │  │  │
│  │  │ └─ Alerts (system notifications)                  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend
- **Framework:** Next.js 16.1.6 with React 19.2.4
- **Styling:** Tailwind CSS 4.2.0 with custom components
- **UI Components:** Radix UI (comprehensive component library)
- **Forms:** React Hook Form + Zod validation
- **Data Fetching:** SWR (stale-while-revalidate)
- **Visualization:** Recharts for analytics, Leaflet for mapping
- **Icons:** Lucide React
- **Notifications:** Sonner toast system

#### Backend
- **API Framework:** Next.js Route Handlers (TypeScript)
- **Database:** Neon PostgreSQL (serverless)
- **Python Services:** FastAPI for AI/ML inference
- **AI/ML Models:**
  - YOLO (Leaf Detection) - `best_leaf_only.pt`
  - PlantDiseaseCNN (Disease Classification) - `plant_cnn_model.pt`
  - DexiNed (Field Boundary Detection)

#### Infrastructure
- **Deployment:** Vercel (Next.js)
- **Database:** Neon (PostgreSQL)
- **Analytics:** Vercel Analytics
- **Environment:** Node.js + Python 3.8+

---

## 📊 Data Model

### Core Entities

#### Drones
```typescript
{
  id: number
  name: string
  model: string
  serial_number: string
  status: 'idle' | 'flying' | 'charging' | 'maintenance' | 'offline'
  battery_level: number (0-100)
  max_flight_time: number (minutes)
  max_speed: number (km/h)
  current_lat: number | null
  current_lng: number | null
  current_altitude: number | null
  home_lat: number | null
  home_lng: number | null
  last_maintenance: string | null
  created_at: string
  updated_at: string
}
```

#### Fields
```typescript
{
  id: number
  name: string
  description: string | null
  area_hectares: number
  crop_type: string
  boundary_coords: Array<{ lat: number; lng: number }>
  center_lat: number
  center_lng: number
  soil_type: string | null
  irrigation_type: string | null
  planting_date: string | null
  expected_harvest: string | null
  created_at: string
  updated_at: string
}
```

#### Flights
```typescript
{
  id: number
  drone_id: number
  field_id: number | null
  mission_type: string
  status: 'planned' | 'in_progress' | 'completed' | 'aborted' | 'failed'
  start_time: string | null
  end_time: string | null
  flight_path: Array<{ lat: number; lng: number; altitude: number }> | null
  distance_km: number | null
  max_altitude: number | null
  avg_speed: number | null
  battery_used: number | null
  weather_conditions: object | null
  notes: string | null
  created_at: string
}
```

#### Plant Detections
```typescript
{
  id: number
  flight_id: number
  sensor_data_id: number | null
  detection_time: string
  lat: number
  lng: number
  plant_type: string
  disease_name: string
  confidence: number (0-1)
  severity: 'low' | 'medium' | 'high' | 'critical'
  affected_area_sqm: number | null
  image_url: string | null
  recommendations: string | null
  status: 'detected' | 'confirmed' | 'treated' | 'resolved' | 'false_positive'
}
```

#### Sensor Data
```typescript
{
  id: number
  flight_id: number
  drone_id: number
  timestamp: string
  lat: number
  lng: number
  altitude: number
  temperature: number | null
  humidity: number | null
  soil_moisture: number | null
  ndvi: number | null (Normalized Difference Vegetation Index)
  battery_level: number | null
  signal_strength: number | null
}
```

#### Alerts
```typescript
{
  id: number
  drone_id: number | null
  flight_id: number | null
  field_id: number | null
  alert_type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string | null
  lat: number | null
  lng: number | null
  is_read: boolean
  is_resolved: boolean
  created_at: string
  resolved_at: string | null
}
```

#### Missions
```typescript
{
  id: number
  name: string
  description: string | null
  field_id: number | null
  drone_id: number | null
  mission_type: 'survey' | 'spray' | 'monitor' | 'mapping' | 'inspection'
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_start: string | null
  scheduled_end: string | null
  waypoints: Array<{ lat: number; lng: number; altitude: number }> | null
  parameters: Record<string, unknown> | null
  repeat_interval: string | null
  created_at: string
  updated_at: string
}
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and pnpm/npm
- Python 3.8+ with pip
- PostgreSQL database (Neon)
- Environment variables configured

### Installation

#### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd agridrone
pnpm install
```

#### 2. Configure Environment Variables
Create `.env.local`:
```env
# Database
DATABASE_URL=postgresql://user:password@host/database

# Python Backend
PYTHON_BACKEND_URL=http://localhost:8001

# Analytics (optional)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

#### 3. Setup Python Backend
```bash
cd python_backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

#### 4. Start Services

**Terminal 1 - Python Backend:**
```bash
cd python_backend
bash start_server.sh
# Server runs at http://localhost:8001
# API docs at http://localhost:8001/docs
```

**Terminal 2 - Next.js Frontend:**
```bash
pnpm dev
# App runs at http://localhost:3000
```

### Verify Installation
- Dashboard: http://localhost:3000
- Python API Health: http://localhost:8001/health
- Python API Docs: http://localhost:8001/docs

---

## 📱 Features & Pages

### Dashboard Pages

| Page | Route | Purpose |
|------|-------|---------|
| **Dashboard** | `/` | Real-time overview of fleet, fields, alerts, and detections |
| **Drones** | `/drones` | Fleet management, status monitoring, maintenance tracking |
| **Fields** | `/fields` | Crop management, field boundaries, area tracking |
| **Flights** | `/flights` | Flight history, mission logs, performance metrics |
| **Missions** | `/missions` | Mission planning, scheduling, waypoint management |
| **Detections** | `/detections` | Disease detection history, severity analysis, recommendations |
| **Alerts** | `/alerts` | System notifications, critical issues, resolution tracking |
| **Live Detection** | `/live-detection` | Real-time plant disease detection from webcam/image upload |
| **Boundary Detection** | `/boundary-detection` | Field boundary detection and mapping |
| **Map** | `/map` | Interactive map view of fields and drone locations |
| **Analytics** | `/analytics` | Historical trends, performance metrics, insights |
| **Settings** | `/settings` | System configuration and preferences |

### Key Features

#### 1. Real-Time Dashboard
- Live drone fleet status with battery levels
- Active alerts with severity indicators
- Recent flight history and mission status
- Environmental sensor data visualization
- Disease detection summary

#### 2. Drone Fleet Management
- Individual drone status and telemetry
- Battery level monitoring and charging schedules
- Maintenance tracking and scheduling
- Real-time location tracking
- Flight time and performance metrics

#### 3. Field Management
- Field boundary mapping and visualization
- Crop type and area tracking
- Soil and irrigation information
- Planting and harvest date management
- Historical field data

#### 4. AI-Powered Disease Detection
- **Live Detection:** Real-time plant disease detection from webcam or image upload
- **Batch Processing:** Process flight images for disease detection
- **38-Class Classification:** Comprehensive plant disease taxonomy
- **Confidence Scoring:** Probability-based disease classification
- **Severity Assessment:** Automatic severity level assignment
- **Recommendations:** Treatment suggestions for detected diseases

#### 5. Mission Planning
- Waypoint-based mission creation
- Automated flight path generation
- Mission scheduling and execution
- Repeat interval configuration
- Real-time mission monitoring

#### 6. Alert System
- Multi-level severity classification (info, warning, error, critical)
- Contextual alerts (drone, flight, field, system)
- Read/unread status tracking
- Resolution workflow
- Alert history and analytics

#### 7. Environmental Monitoring
- Temperature tracking
- Humidity monitoring
- Soil moisture measurement
- NDVI (vegetation health) calculation
- Signal strength monitoring

#### 8. Analytics & Reporting
- Historical trend analysis
- Performance metrics
- Disease prevalence tracking
- Fleet utilization reports
- Environmental condition trends

---

## 🤖 AI/ML Pipeline

### Plant Disease Detection System

#### Architecture
```
Input Image
    ↓
[YOLO Leaf Detection]
    ├─ Model: best_leaf_only.pt
    ├─ Confidence: 0.70
    ├─ Image Size: 512x512
    └─ Output: Leaf bounding boxes
    ↓
[HSV Mask Validation]
    ├─ Color Range: [15,10,10] → [110,255,255]
    ├─ Leaf Ratio Check: < 0.30
    └─ Valid Leaf Detection
    ↓
[Image Preprocessing]
    ├─ CLAHE Normalization (clip=3.0, 8×8 tiles)
    ├─ Contrast Enhancement
    └─ Standardization
    ↓
[PlantDiseaseCNN Classification]
    ├─ Model: plant_cnn_model.pt
    ├─ Classes: 38 plant diseases
    ├─ Confidence Threshold: 0.80
    └─ Output: Disease class + confidence
    ↓
[Decision Logic]
    ├─ Confidence ≥ 0.80 → DISEASED
    ├─ 0.50 ≤ Confidence < 0.80 → UNCERTAIN
    └─ Confidence < 0.50 → HEALTHY
    ↓
Result (Disease, Confidence, Severity)
```

#### Supported Disease Classes (38 Total)
- Apple Scab
- Corn Leaf Blight
- Grape Black Rot
- Orange Citrus Greening
- Potato Early Blight
- Rice Blast
- Tomato Late Blight
- Wheat Yellow Rust
- And 30+ more...

#### API Endpoint
```typescript
POST /api/plant-detect
Content-Type: application/json

{
  "image_base64": "data:image/jpeg;base64,...",
  "lat": 28.6139,
  "lng": 77.2090,
  "flight_id": 1,
  "save_to_db": true
}

Response:
{
  "disease": "tomato_late_blight",
  "confidence": 0.92,
  "severity": "high",
  "recommendations": "Apply fungicide treatment...",
  "detection_id": 123
}
```

### Field Boundary Detection

Uses DexiNed (Dense Extreme Inception Network) for edge detection and field boundary extraction.

---

## 🔌 API Reference

### Drone Management
```typescript
GET    /api/drones              // List all drones
POST   /api/drones              // Create new drone
GET    /api/drones/:id          // Get drone details
PATCH  /api/drones/:id          // Update drone status
DELETE /api/drones/:id          // Remove drone
```

### Field Management
```typescript
GET    /api/fields              // List all fields
POST   /api/fields              // Create new field
GET    /api/fields/:id          // Get field details
PATCH  /api/fields/:id          // Update field
DELETE /api/fields/:id          // Remove field
```

### Flight Operations
```typescript
GET    /api/flights             // List flights
POST   /api/flights             // Create flight
GET    /api/flights/:id         // Get flight details
PATCH  /api/flights/:id         // Update flight status
```

### Mission Management
```typescript
GET    /api/missions            // List missions
POST   /api/missions            // Create mission
GET    /api/missions/:id        // Get mission details
PATCH  /api/missions/:id        // Update mission
DELETE /api/missions/:id        // Cancel mission
```

### Sensor Data
```typescript
GET    /api/sensor-data         // Get sensor readings
GET    /api/sensor-data?limit=20 // Paginated results
POST   /api/sensor-data         // Record sensor data
```

### Plant Detection
```typescript
POST   /api/plant-detect        // Detect disease from image
GET    /api/plant-detect        // Health check
GET    /api/detections          // List all detections
PATCH  /api/detections/:id      // Update detection status
```

### Alerts
```typescript
GET    /api/alerts              // List alerts
PATCH  /api/alerts              // Mark as read/resolved
DELETE /api/alerts/:id          // Delete alert
```

### Dashboard
```typescript
GET    /api/dashboard           // Get dashboard statistics
```

---

## 🗺️ Future Feature Roadmap

### Phase 1: Enhanced Analytics (Q2 2026)
- [ ] Advanced disease trend analysis
- [ ] Predictive disease outbreak modeling
- [ ] Crop yield prediction based on health metrics
- [ ] Historical comparison and seasonal analysis
- [ ] Custom report generation and export (PDF/CSV)
- [ ] Data visualization improvements (3D field maps, heatmaps)

### Phase 2: Autonomous Operations (Q3 2026)
- [ ] Autonomous mission execution with real-time adjustments
- [ ] Weather-aware flight planning and rescheduling
- [ ] Automated drone charging station integration
- [ ] Swarm coordination for multi-drone operations
- [ ] Collision avoidance and obstacle detection
- [ ] Automated return-to-home on low battery

### Phase 3: Advanced AI/ML (Q4 2026)
- [ ] Multi-model ensemble for improved accuracy
- [ ] Transfer learning for custom disease models
- [ ] Real-time video stream processing
- [ ] Weed detection and classification
- [ ] Pest detection and identification
- [ ] Crop stress detection (water, nutrient deficiency)
- [ ] Model versioning and A/B testing

### Phase 4: Integration & Ecosystem (Q1 2027)
- [ ] Weather API integration (OpenWeather, Weather.com)
- [ ] Soil testing lab integration
- [ ] Agronomist consultation marketplace
- [ ] Pesticide/fertilizer recommendation engine
- [ ] Supply chain integration (input ordering)
- [ ] IoT sensor integration (soil probes, weather stations)
- [ ] Drone hardware API integration (DJI, Auterion)

### Phase 5: Mobile & Offline (Q2 2027)
- [ ] Native mobile app (iOS/Android)
- [ ] Offline mode with sync capabilities
- [ ] Mobile-optimized detection interface
- [ ] Push notifications for critical alerts
- [ ] Field crew communication tools
- [ ] Offline map caching

### Phase 6: Enterprise Features (Q3 2027)
- [ ] Multi-tenant support
- [ ] Role-based access control (RBAC)
- [ ] Audit logging and compliance
- [ ] API key management
- [ ] Webhook integrations
- [ ] Custom branding and white-labeling
- [ ] SSO/SAML authentication
- [ ] Advanced permission management

### Phase 7: Marketplace & Monetization (Q4 2027)
- [ ] Disease treatment marketplace
- [ ] Expert consultation booking
- [ ] Equipment rental integration
- [ ] Crop insurance integration
- [ ] Carbon credit tracking
- [ ] Sustainability reporting

### Phase 8: Advanced Autonomy (2028+)
- [ ] Reinforcement learning for optimal flight paths
- [ ] Predictive maintenance using ML
- [ ] Anomaly detection in sensor data
- [ ] Automated alert response workflows
- [ ] Computer vision for crop counting
- [ ] Biomass estimation
- [ ] 3D field reconstruction

---

## 🔐 Security Considerations

- **Database:** Neon PostgreSQL with encryption at rest
- **API:** HTTPS only, CORS configured
- **Authentication:** Environment-based (ready for OAuth2/JWT)
- **Image Storage:** Secure URL-based access
- **Data Privacy:** Compliant with agricultural data regulations
- **Model Security:** Containerized inference services

---

## 📈 Performance Metrics

### Dashboard
- Real-time data refresh: 10-30 seconds
- Page load time: < 2 seconds
- API response time: < 500ms

### AI Detection
- Image processing: 2-5 seconds per image
- Model inference: 1-2 seconds
- Batch processing: 10-20 images/minute

### Database
- Query optimization: Indexed on frequently accessed fields
- Connection pooling: Neon serverless connections
- Data retention: Configurable archival policies

---

## 🛠️ Development

### Project Structure
```
agridrone/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   ├── alerts/                   # Alerts page
│   ├── analytics/                # Analytics page
│   ├── boundary-detection/       # Boundary detection page
│   ├── detections/               # Detections page
│   ├── drones/                   # Drones management page
│   ├── fields/                   # Fields management page
│   ├── flights/                  # Flights page
│   ├── live-detection/           # Live detection page
│   ├── map/                      # Map view page
│   ├── missions/                 # Missions page
│   ├── settings/                 # Settings page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Dashboard
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── dashboard/                # Dashboard components
│   ├── map/                      # Map components
│   ├── ui/                       # UI component library
│   └── theme-provider.tsx        # Theme configuration
├── hooks/                        # Custom React hooks
├── lib/                          # Utilities and database
├── python_backend/               # Python AI services
│   ├── detection_server.py       # FastAPI server
│   ├── model_loader.py           # Model management
│   ├── field_boundary_server.py  # Boundary detection
│   ├── dexined/                  # DexiNed model
│   ├── models/                   # ML models directory
│   └── requirements.txt          # Python dependencies
├── public/                       # Static assets
├── package.json                  # Node dependencies
├── next.config.mjs               # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

### Running Tests
```bash
# Frontend tests (when available)
pnpm test

# Linting
pnpm lint

# Type checking
pnpm tsc --noEmit
```

### Building for Production
```bash
# Build Next.js
pnpm build

# Start production server
pnpm start

# Python backend production
cd python_backend
gunicorn -w 4 -k uvicorn.workers.UvicornWorker detection_server:app
```

---

## 📚 Documentation

- **API Documentation:** http://localhost:8001/docs (when backend running)
- **Database Schema:** See `lib/db.ts` for TypeScript types
- **Component Library:** Radix UI components in `components/ui/`
- **Python Backend:** See `python_backend/README.md`

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit pull request

---

## 📄 License

[Add your license here]

---

## 📞 Support

For issues, questions, or feature requests, please open an issue on the repository.

---

## 🙏 Acknowledgments

- YOLO for object detection
- PlantDiseaseCNN for disease classification
- DexiNed for edge detection
- Radix UI for component library
- Neon for serverless PostgreSQL
- Vercel for Next.js hosting

---

**Last Updated:** April 2026  
**Version:** 1.0.0  
**Status:** Active Development
# Agri-Drone
