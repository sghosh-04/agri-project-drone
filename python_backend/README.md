# Plant Disease Detection — Integration Guide

## Overview

The `/plant` detection system (YOLO + PlantDiseaseCNN) has been fully integrated into the **AgriDrone** Next.js dashboard.

---

## Architecture

```
Browser (Next.js)
     │  uploads image / captures webcam frame
     ▼
/app/live-detection         ← New page in AgriDrone
     │  POST /api/plant-detect
     ▼
/app/api/plant-detect/route.ts   ← Next.js proxy API
     │  forwards to Python backend
     ▼
python_backend/detection_server.py  (FastAPI @ :8001)
     │  YOLO leaf detection (best_leaf_only.pt)
     │  HSV mask validation
     │  CLAHE normalisation
     │  CNN classification (plant_cnn_model.pt)
     ▼
Result returned → proxy stores in Neon DB → shown in UI
```

The **detection logic is 100% unchanged** from `/plant/main.py`:
- Same YOLO conf=0.70, imgsz=512
- Same HSV mask bounds [15,10,10] → [110,255,255]
- Same leaf_ratio < 0.30 block
- Same CLAHE clip=3.0, 8×8 tiles
- Same `PlantDiseaseCNN` architecture from `model_loader.py`
- Same 38-class names in the same order
- Same HEALTHY / UNCERTAIN (conf < 0.80) / DISEASED decision

---

## How to Run

### Step 1 — Start the Python Detection Backend

```bash
cd "/Users/satwikmukherjee/Desktop/agri project"
bash python_backend/start_server.sh
```

This will:
1. Activate the `/plant/.venv` virtual environment automatically
2. Install any missing packages from `requirements.txt`
3. Start the FastAPI server at **http://localhost:8001**

Verify it's running: http://localhost:8001/health  
Interactive API docs: http://localhost:8001/docs

### Step 2 — Start the Next.js App

```bash
cd "/Users/satwikmukherjee/Desktop/agri project"
pnpm dev   # or npm run dev
```

### Step 3 — Open Live Detection

Navigate to: **http://localhost:3000/live-detection**

---

## Files Added / Modified

| File | Description |
|------|-------------|
| `python_backend/detection_server.py` | FastAPI server wrapping plant detection |
| `python_backend/model_loader.py` | PlantDiseaseCNN class (unchanged copy) |
| `python_backend/requirements.txt` | Python dependencies |
| `python_backend/start_server.sh` | Shell script to start backend |
| `app/api/plant-detect/route.ts` | Next.js API proxy + DB persistence |
| `app/live-detection/page.tsx` | New Live Detection page |
| `components/dashboard/sidebar.tsx` | Added "Live Detection" nav link |
| `.env.local` | `PYTHON_BACKEND_URL=http://localhost:8001` |

---

## Model Files

The Python backend reads model files **directly from `/plant/`** — no copying needed:
- `/plant/best_leaf_only.pt` — YOLO leaf detector
- `/plant/plant_cnn_model.pt` — PlantDiseaseCNN

To use different paths, set environment variables before starting:
```bash
export LEAF_MODEL_PATH=/path/to/best_leaf_only.pt
export CNN_MODEL_PATH=/path/to/plant_cnn_model.pt
```

---

## API Reference

### `POST /api/plant-detect` (Next.js)
```json
{
  "image_base64": "data:image/jpeg;base64,...",
  "lat": 28.6139,
  "lng": 77.2090,
  "flight_id": 1,
  "save_to_db": true
}
```

### `GET /api/plant-detect` (Next.js)
Returns backend health status.
