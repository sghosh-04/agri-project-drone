"""
Agriculture Disease Detection Server
=====================================
TWO-STAGE leaf disease detection pipeline:

  STAGE 1 — Leaf Presence Check:
    YOLO detector scans the image for plant regions.
    If the detected class is NOT a leaf (e.g. stem, fruit, root) → returns NOT_LEAF.
    HSV-based fallback confirms plant tissue when YOLO finds nothing.

  STAGE 2 — Disease Classification:
    Runs ONLY when a leaf is confirmed in Stage 1.
    CLAHE normalisation → CNN disease classifier → HEALTHY / DISEASED / UNCERTAIN.

Exposes a REST API consumed by the Next.js AgriDrone frontend.

Run with:
    uvicorn detection_server:app --host 0.0.0.0 --port 8001 --reload

Required model files:
    - best_leaf_only.pt   (YOLO crop/plant detector — detects any plant part)
    - plant_cnn_model.pt  (PlantDiseaseCNN — 38 disease classes)
"""

import os
import sys
import warnings
import base64
import io
import time
import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import torch
import torch.serialization
import pickle
from PIL import Image
from torchvision import transforms
from ultralytics import YOLO
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# Suppress noise
warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths — auto-discover every .pt in python_backend/models/
# Falls back to legacy /Desktop/plant/ for backward compat.
# ---------------------------------------------------------------------------
_THIS_DIR   = Path(__file__).parent
_MODELS_DIR = _THIS_DIR / "models"              # python_backend/models/
_PLANT_DIR  = _THIS_DIR.parent.parent / "plant" # /Desktop/plant (legacy)

def _discover_model_files() -> list[Path]:
    """Return every .pt file found in models/ (sorted for determinism)."""
    pts = sorted(_MODELS_DIR.glob("*.pt"))
    if not pts:
        # Legacy fallback: look in /Desktop/plant/
        pts = sorted(_PLANT_DIR.glob("*.pt"))
    return pts

ALL_MODEL_PATHS = _discover_model_files()

# ---------------------------------------------------------------------------
# 38 agriculture disease class names
# ---------------------------------------------------------------------------
CLASS_NAMES = [
    "Apple_Apple_scab", "Apple_Black_rot", "Apple_Cedar_apple_rust", "Apple_healthy",
    "Blueberry_healthy", "Cherry_Powdery_mildew", "Cherry_healthy",
    "Corn_Cercospora_leaf_spot Gray_leaf_spot", "Corn_Common_rust",
    "Corn_Northern_Leaf_Blight", "Corn_healthy",
    "Grape_Black_rot", "Grape_Esca", "Grape_Leaf_blight", "Grape_healthy",
    "Orange_Haunglongbing", "Peach_Bacterial_spot", "Peach_healthy",
    "Pepper_bell_Bacterial_spot", "Pepper_bell_healthy",
    "Potato_Early_blight", "Potato_Late_blight", "Potato_healthy",
    "Raspberry_healthy", "Soybean_healthy",
    "Squash_Powdery_mildew", "Strawberry_Leaf_scorch", "Strawberry_healthy",
    "Tomato_Bacterial_spot", "Tomato_Early_blight", "Tomato_Late_blight",
    "Tomato_Leaf_Mold", "Tomato_Septoria_leaf_spot",
    "Tomato_Spider_mites", "Tomato_Target_Spot",
    "Tomato_Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato_Tomato_mosaic_virus", "Tomato_healthy",
]

# ---------------------------------------------------------------------------
# Disease metadata: treatment hints, severity, affected part, category
# ---------------------------------------------------------------------------
DISEASE_INFO: dict[str, dict] = {
    # Apple
    "Apple_Apple_scab":             {"severity": "medium", "part": "leaf/fruit",  "category": "fungal",    "treatment": "Apply myclobutanil or captan fungicide; remove infected leaves."},
    "Apple_Black_rot":              {"severity": "high",   "part": "fruit/stem",  "category": "fungal",    "treatment": "Prune infected wood; apply copper-based fungicide before bloom."},
    "Apple_Cedar_apple_rust":       {"severity": "medium", "part": "leaf",         "category": "fungal",    "treatment": "Remove nearby juniper hosts; spray myclobutanil at pink stage."},
    "Apple_healthy":                {"severity": "none",   "part": "whole plant",  "category": "healthy",   "treatment": "No treatment needed."},
    # Blueberry
    "Blueberry_healthy":            {"severity": "none",   "part": "whole plant",  "category": "healthy",   "treatment": "No treatment needed."},
    # Cherry
    "Cherry_Powdery_mildew":        {"severity": "medium", "part": "leaf/shoot",   "category": "fungal",    "treatment": "Apply sulfur or potassium bicarbonate; improve air circulation."},
    "Cherry_healthy":               {"severity": "none",   "part": "whole plant",  "category": "healthy",   "treatment": "No treatment needed."},
    # Corn
    "Corn_Cercospora_leaf_spot Gray_leaf_spot": {"severity": "high",   "part": "leaf",  "category": "fungal",    "treatment": "Rotate crops; apply triazole fungicide at tassel emergence."},
    "Corn_Common_rust":             {"severity": "medium", "part": "leaf",          "category": "fungal",    "treatment": "Plant resistant varieties; apply fungicide at first sign."},
    "Corn_Northern_Leaf_Blight":    {"severity": "high",   "part": "leaf",          "category": "fungal",    "treatment": "Use resistant hybrids; apply propiconazole fungicide."},
    "Corn_healthy":                 {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    # Grape
    "Grape_Black_rot":              {"severity": "critical","part": "fruit/leaf",  "category": "fungal",    "treatment": "Remove mummified fruit; apply myclobutanil or mancozeb."},
    "Grape_Esca":                   {"severity": "critical","part": "stem/wood",   "category": "fungal",    "treatment": "Prune infected canes; apply wound sealant; no curative treatment."},
    "Grape_Leaf_blight":            {"severity": "high",   "part": "leaf",          "category": "fungal",    "treatment": "Apply copper fungicide; ensure good canopy airflow."},
    "Grape_healthy":                {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    # Orange
    "Orange_Haunglongbing":         {"severity": "critical","part": "leaf/fruit",  "category": "bacterial", "treatment": "Remove infected trees; control psyllid vectors with insecticide."},
    # Peach
    "Peach_Bacterial_spot":         {"severity": "high",   "part": "leaf/fruit",   "category": "bacterial", "treatment": "Apply copper bactericide; avoid overhead irrigation."},
    "Peach_healthy":                {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    # Pepper
    "Pepper_bell_Bacterial_spot":   {"severity": "high",   "part": "leaf/fruit",   "category": "bacterial", "treatment": "Copper-based bactericide; use certified disease-free seed."},
    "Pepper_bell_healthy":          {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    # Potato
    "Potato_Early_blight":          {"severity": "medium", "part": "leaf/stem",    "category": "fungal",    "treatment": "Apply chlorothalonil or mancozeb; practice crop rotation."},
    "Potato_Late_blight":           {"severity": "critical","part": "leaf/tuber",  "category": "fungal",    "treatment": "Apply metalaxyl or cymoxanil; destroy infected haulms immediately."},
    "Potato_healthy":               {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    # Raspberry / Soybean
    "Raspberry_healthy":            {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    "Soybean_healthy":              {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    # Squash / Strawberry
    "Squash_Powdery_mildew":        {"severity": "medium", "part": "leaf",          "category": "fungal",    "treatment": "Apply potassium bicarbonate or neem oil; increase spacing."},
    "Strawberry_Leaf_scorch":       {"severity": "medium", "part": "leaf",          "category": "fungal",    "treatment": "Remove infected leaves; apply captan fungicide."},
    "Strawberry_healthy":           {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
    # Tomato
    "Tomato_Bacterial_spot":        {"severity": "high",   "part": "leaf/fruit",   "category": "bacterial", "treatment": "Apply copper bactericide; avoid working in wet fields."},
    "Tomato_Early_blight":          {"severity": "medium", "part": "leaf/stem",    "category": "fungal",    "treatment": "Apply chlorothalonil; remove lower infected leaves."},
    "Tomato_Late_blight":           {"severity": "critical","part": "leaf/stem/fruit","category": "fungal", "treatment": "Apply metalaxyl; destroy infected plant material immediately."},
    "Tomato_Leaf_Mold":             {"severity": "medium", "part": "leaf",          "category": "fungal",    "treatment": "Improve ventilation; apply chlorothalonil or mancozeb."},
    "Tomato_Septoria_leaf_spot":    {"severity": "medium", "part": "leaf",          "category": "fungal",    "treatment": "Remove infected leaves; apply mancozeb or copper fungicide."},
    "Tomato_Spider_mites":          {"severity": "high",   "part": "leaf",          "category": "pest",      "treatment": "Apply acaricide (abamectin); introduce predatory mites."},
    "Tomato_Target_Spot":           {"severity": "high",   "part": "leaf/fruit",   "category": "fungal",    "treatment": "Apply azoxystrobin or pyraclostrobin; practice crop rotation."},
    "Tomato_Tomato_Yellow_Leaf_Curl_Virus": {"severity": "critical","part": "leaf/whole plant","category": "viral","treatment": "Control whitefly vectors; use resistant varieties; remove infected plants."},
    "Tomato_Tomato_mosaic_virus":   {"severity": "critical","part": "leaf/fruit",  "category": "viral",    "treatment": "Remove infected plants; disinfect tools; use virus-free seed."},
    "Tomato_healthy":               {"severity": "none",   "part": "whole plant",   "category": "healthy",   "treatment": "No treatment needed."},
}

def get_disease_info(label: str) -> dict:
    """Return metadata for a given class label, with safe defaults."""
    info = DISEASE_INFO.get(label)
    if info:
        return info
    # Fallback for unknown / future classes
    is_healthy = "healthy" in label.lower()
    return {
        "severity": "none" if is_healthy else "medium",
        "part": "whole plant",
        "category": "healthy" if is_healthy else "unknown",
        "treatment": "No treatment needed." if is_healthy else "Consult a local agronomist for advice.",
    }

# ---------------------------------------------------------------------------
# Image preprocessing transform  (identical to /plant/main.py)
# ---------------------------------------------------------------------------
transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


def preprocess(img_bgr: np.ndarray) -> torch.Tensor:
    """BGR numpy → normalised tensor (identical to /plant/main.py)."""
    img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(img)
    img = transform(img)
    return img.unsqueeze(0)


# ---------------------------------------------------------------------------
# Device selection  (identical to /plant/main.py)
# ---------------------------------------------------------------------------
if torch.backends.mps.is_available():
    device = torch.device("mps")
    logger.info("Using Apple MPS GPU 🚀")
elif torch.cuda.is_available():
    device = torch.device("cuda")
    logger.info("Using CUDA GPU 🚀")
else:
    device = torch.device("cpu")
    logger.info("Using CPU")

# ---------------------------------------------------------------------------
# Load models at startup — uses ALL .pt files discovered in models/
# ---------------------------------------------------------------------------
sys.path.insert(0, str(_THIS_DIR))
from model_loader import PlantDiseaseCNN  # noqa: E402

if not ALL_MODEL_PATHS:
    raise FileNotFoundError(
        f"No .pt model files found.\n"
        f"  Searched: {_MODELS_DIR}\n"
        f"  Please place model files in that directory."
    )

logger.info(f"Discovered {len(ALL_MODEL_PATHS)} model file(s) in {_MODELS_DIR}:")
for p in ALL_MODEL_PATHS:
    logger.info(f"  - {p.name} ({p.stat().st_size // 1024} KB)")

# -----------------------------------------------------------------------
# Custom unpickler — redirects __main__.PlantDiseaseCNN
# (needed when .pt was saved from /plant/main.py, class was in __main__)
# -----------------------------------------------------------------------
class _ModelUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if name == 'PlantDiseaseCNN':
            return PlantDiseaseCNN
        return super().find_class(module, name)


class _PickleModule:
    """Minimal pickle-module shim using our custom Unpickler."""
    Unpickler = _ModelUnpickler
    dump  = staticmethod(pickle.dump)
    dumps = staticmethod(pickle.dumps)


def _try_load_yolo(path: Path):
    """Attempt to load a .pt file as a YOLO model. Raises on failure."""
    return YOLO(str(path))


def _try_load_cnn(path: Path, map_device):
    """Attempt to load a .pt file as a PlantDiseaseCNN. Raises on failure."""
    with open(path, 'rb') as f:
        raw = f.read()

    # Strategy 1 — custom unpickler (handles __main__ refs)
    try:
        buf = io.BytesIO(raw)
        obj = torch.load(buf, map_location=map_device,
                         pickle_module=_PickleModule,
                         weights_only=False)
        if isinstance(obj, dict):
            m = PlantDiseaseCNN()
            m.load_state_dict(obj)
            return m
        if isinstance(obj, PlantDiseaseCNN):
            return obj
        raise TypeError(f"Unexpected object type: {type(obj)}")
    except Exception as e1:
        pass

    # Strategy 2 — pure state-dict (weights_only=True)
    try:
        state = torch.load(io.BytesIO(raw), map_location=map_device, weights_only=True)
        m = PlantDiseaseCNN()
        m.load_state_dict(state)
        return m
    except Exception as e2:
        raise RuntimeError(f"CNN load failed: {e1} | {e2}")


# -----------------------------------------------------------------------
# Classify every discovered .pt as YOLO or CNN, then load all of them.
# YOLO detectors  → Stage 1 ensemble (leaf presence check)
# CNN classifiers → Stage 2 ensemble (disease classification)
# -----------------------------------------------------------------------
yolo_detectors:   list        = []   # YOLO models for Stage 1
cnn_models:       list        = []   # CNN models for Stage 2
yolo_model_names: list[str]   = []
cnn_model_names:  list[str]   = []

for model_path in ALL_MODEL_PATHS:
    loaded = False

    # Try YOLO first (fastest check: just instantiate and catch)
    try:
        yolo = _try_load_yolo(model_path)
        yolo_detectors.append(yolo)
        yolo_model_names.append(model_path.name)
        logger.info(f"  [YOLO] Loaded '{model_path.name}' successfully")
        loaded = True
    except Exception as ye:
        logger.debug(f"  '{model_path.name}' is not a YOLO model ({ye}), trying CNN...")

    if not loaded:
        try:
            cnn = _try_load_cnn(model_path, device)
            cnn.to(device)
            cnn.eval()
            cnn_models.append(cnn)
            cnn_model_names.append(model_path.name)
            logger.info(f"  [CNN]  Loaded '{model_path.name}' successfully")
            loaded = True
        except Exception as ce:
            logger.warning(f"  Could not load '{model_path.name}' as YOLO or CNN: {ce}")

if not yolo_detectors:
    raise RuntimeError(
        "No YOLO detector could be loaded from models/. "
        "Ensure at least one YOLO .pt file (e.g. best_leaf_only.pt) is present."
    )
if not cnn_models:
    raise RuntimeError(
        "No CNN classifier could be loaded from models/. "
        "Ensure at least one CNN .pt file (e.g. plant_cnn_model.pt) is present."
    )

logger.info(
    f"Ensemble ready: "
    f"{len(yolo_detectors)} YOLO detector(s): {yolo_model_names}, "
    f"{len(cnn_models)} CNN classifier(s): {cnn_model_names}"
)

# Convenience alias for legacy code references
cnn_model = cnn_models[0]

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Agriculture Disease Detection API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Next.js dev / prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class DetectRequest(BaseModel):
    """Send a base64-encoded image (JPEG/PNG) for analysis."""
    image_base64: str          # data-URL or raw base64
    lat: Optional[float] = None
    lng: Optional[float] = None
    flight_id: Optional[int] = None
    sensor_data_id: Optional[int] = None


# YOLO class names that are considered "leaf" detections for Stage 1
LEAF_CLASS_KEYWORDS = {"leaf", "leaves", "foliage", "lamina", "frond", "blade"}


def _is_leaf_class(cls_name: str) -> bool:
    """Return True if the YOLO class name indicates a leaf."""
    return any(kw in cls_name.lower() for kw in LEAF_CLASS_KEYWORDS)


def _frame_has_plant_content(frame: np.ndarray, min_ratio: float = 0.20) -> tuple[bool, float]:
    """
    GLOBAL PRE-FLIGHT CHECK: does the frame contain enough HIGH-SATURATION
    plant-green pixels?  Key insight: plant leaves have sat >= 60 in HSV.
    Walls, skin, fabric, and most indoor surfaces have sat < 50 — they
    will NOT trigger this check even if they look slightly greenish.

    Returns (has_plant, green_ratio).
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    # Strict plant green: hue 35-85, saturation >= 60 (real chlorophyll)
    mask_green  = cv2.inRange(hsv, np.array([35, 60, 40]), np.array([85, 255, 255]))
    # Diseased/yellowed leaves: hue 22-35, saturation >= 60
    mask_yellow = cv2.inRange(hsv, np.array([22, 60, 60]), np.array([35, 255, 255]))
    combined = cv2.bitwise_or(mask_green, mask_yellow)
    ratio = float(np.sum(combined > 0)) / combined.size
    return ratio >= min_ratio, ratio


def _frame_has_centered_face(frame: np.ndarray, skin_threshold: float = 0.25) -> bool:
    """
    Checks whether the CENTER REGION of the frame (where a webcam selfie
    face would appear) is dominated by human skin tones.
    Rejects person-facing-camera frames even when background walls are green.
    """
    h, w = frame.shape[:2]
    # Sample the central 50% x 60% region
    cy1, cy2 = h // 4, 3 * h // 4
    cx1, cx2 = w // 4, 3 * w // 4
    center = frame[cy1:cy2, cx1:cx2]
    return _roi_is_skin_dominated(center, skin_threshold=skin_threshold)


def _roi_is_skin_dominated(roi: np.ndarray, skin_threshold: float = 0.45) -> bool:
    """
    Returns True if more than `skin_threshold` of the ROI pixels are human
    skin-toned — used to reject false-positive YOLO boxes on faces/hands/arms.

    Skin tones in HSV:  hue 0-20 (red-orange), sat 20-150, val 50-255
    This also covers darker skin: broadened hue range used.
    """
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    # Light/medium skin tones
    mask1 = cv2.inRange(hsv, np.array([ 0, 20,  60]), np.array([20, 150, 255]))
    # Darker skin tones (slightly higher hue, broader sat)
    mask2 = cv2.inRange(hsv, np.array([160, 20, 60]), np.array([180, 150, 255]))
    skin_mask = cv2.bitwise_or(mask1, mask2)
    skin_ratio = float(np.sum(skin_mask > 0)) / skin_mask.size
    return skin_ratio >= skin_threshold


class LeafResult(BaseModel):
    # ---- Stage metadata ----
    detection_stage: int       # 1 = stopped at leaf-check, 2 = reached disease classification
    is_leaf: bool              # True if Stage 1 confirmed a leaf
    not_leaf_reason: str       # Human-readable explanation when is_leaf=False

    # ---- Detection outcome ----
    leaf_detected: bool
    status: str                # "HEALTHY" | "DISEASED" | "UNCERTAIN" | "NO_CROP" | "MASKED_WEAK" | "NOT_LEAF"
    label: str
    confidence: float
    class_index: int
    plant_type: str
    disease_name: str
    affected_part: str         # e.g. "leaf", "stem", "fruit", "root", "whole plant"
    category: str              # "fungal" | "bacterial" | "viral" | "pest" | "nutrient" | "healthy" | "unknown"
    treatment_hint: str        # Short recommended treatment
    severity: str              # "none" | "low" | "medium" | "high" | "critical"
    bbox: Optional[list] = None   # [x1, y1, x2, y2]
    annotated_image_base64: Optional[str] = None


class DetectResponse(BaseModel):
    leaves: list[LeafResult]   # kept as 'leaves' for API compatibility
    total_leaves: int          # number of crop regions detected
    processing_time_ms: float




# ---------------------------------------------------------------------------
# Core detection logic  — unchanged pipeline from /plant/main.py
# ---------------------------------------------------------------------------
def decode_image(image_base64: str) -> np.ndarray:
    """Decode base64 (with or without data-URL prefix) → BGR numpy array."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    raw = base64.b64decode(image_base64)
    buf = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def process_frame(frame: np.ndarray) -> list[LeafResult]:
    """
    TWO-STAGE agriculture disease detection pipeline:

    ┌─ STAGE 1: Leaf Presence Check ───────────────────────────────────────┐
    │  YOLO detects plant/crop regions (conf=0.50, imgsz=640).             │
    │  If a region's class name does NOT contain a leaf keyword            │
    │  (e.g. "stem", "fruit", "root") → returns NOT_LEAF immediately.       │
    │  HSV fallback: if YOLO missed everything but ≥40% of the frame is    │
    │  green/yellow tissue → treat whole frame as a potential leaf.        │
    └──────────────────────────────────────────────────────────────────────┘
    ┌─ STAGE 2: Disease Classification (leaf-confirmed regions only) ───────┐
    │  CLAHE normalisation → CNN (38 disease classes)                      │
    │  → HEALTHY / UNCERTAIN / DISEASED decision                           │
    │  Enriched with affected_part, category, treatment_hint, severity.    │
    └──────────────────────────────────────────────────────────────────────┘
    """
    results_list: list[LeafResult] = []

    # =========================================================
    # PRE-FLIGHT: Global plant-greenness check
    # If the entire frame doesn't have enough green/yellow-green
    # pixels it cannot be a leaf — reject immediately without
    # running any model (guards against faces, rooms, blank walls).
    # =========================================================
    frame_has_plant, global_green_ratio = _frame_has_plant_content(frame, min_ratio=0.20)
    logger.info(f"[Pre-flight] global_green_ratio={global_green_ratio:.3f} "
                f"({'PASS' if frame_has_plant else 'FAIL — not a plant image'})")

    if not frame_has_plant:
        return [LeafResult(
            detection_stage=1,
            is_leaf=False,
            not_leaf_reason=(
                f"Image lacks sufficient plant-green pixels "
                f"({global_green_ratio:.1%} < 20% required). "
                "Please point the camera at a leaf."
            ),
            leaf_detected=False,
            status="NO_CROP",
            label="NO PLANT TISSUE DETECTED",
            confidence=0.0,
            class_index=-1,
            plant_type="",
            disease_name="",
            affected_part="",
            category="unknown",
            treatment_hint="Ensure the camera is pointed at a leaf or plant part.",
            severity="none",
        )]

    # Secondary pre-flight: reject selfie/face frames even with green background
    if _frame_has_centered_face(frame, skin_threshold=0.25):
        logger.info("[Pre-flight] Center-face detected — rejecting as non-plant.")
        return [LeafResult(
            detection_stage=1,
            is_leaf=False,
            not_leaf_reason="A human face was detected in the center of the frame. Please point the camera at a leaf.",
            leaf_detected=False,
            status="NO_CROP",
            label="FACE DETECTED — NOT A PLANT",
            confidence=0.0,
            class_index=-1,
            plant_type="",
            disease_name="",
            affected_part="",
            category="unknown",
            treatment_hint="Point the camera at a leaf or plant part, not at a person.",
            severity="none",
        )]

    # =========================================================
    # STAGE 1 — YOLO Ensemble: run ALL detectors, merge boxes
    # =========================================================
    all_raw_boxes: list[tuple[int, int, int, int, str, float]] = []

    for detector in yolo_detectors:
        yolo_results = detector(frame, conf=0.50, imgsz=640, verbose=False)
        if (yolo_results is not None
                and yolo_results[0].boxes is not None
                and len(yolo_results[0].boxes) > 0):
            for box in yolo_results[0].boxes:
                cls_id   = int(box.cls[0])
                cls_name = yolo_results[0].names[cls_id].lower()
                x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                score = float(box.conf[0])
                all_raw_boxes.append((x1, y1, x2, y2, cls_name, score))

    # NMS across merged boxes (suppress highly overlapping duplicates)
    def _iou(b1, b2):
        ix1, iy1 = max(b1[0], b2[0]), max(b1[1], b2[1])
        ix2, iy2 = min(b1[2], b2[2]), min(b1[3], b2[3])
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        a1 = (b1[2]-b1[0]) * (b1[3]-b1[1])
        a2 = (b2[2]-b2[0]) * (b2[3]-b2[1])
        return inter / (a1 + a2 - inter + 1e-6)

    # Sort by confidence descending, then greedy NMS
    all_raw_boxes.sort(key=lambda b: b[5], reverse=True)
    kept_boxes: list[tuple[int, int, int, int, str, float]] = []
    for cand in all_raw_boxes:
        if all(_iou(cand, kept) < 0.45 for kept in kept_boxes):
            kept_boxes.append(cand)

    boxes = kept_boxes  # list of (x1, y1, x2, y2, cls_name, score)

    # ---- Fallback: YOLO found nothing — strict high-saturation plant check ----
    # Uses the SAME strict HSV as the pre-flight (sat>=60) so walls/skin
    # that already passed the loose pre-flight don't sneak through here.
    is_fallback = False
    if not boxes:
        hsv_full = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask_strict_g = cv2.inRange(hsv_full, np.array([35, 60, 40]), np.array([85, 255, 255]))
        mask_strict_y = cv2.inRange(hsv_full, np.array([22, 60, 60]), np.array([35, 255, 255]))
        mask_strict   = cv2.bitwise_or(mask_strict_g, mask_strict_y)
        plant_ratio_full = float(np.sum(mask_strict > 0)) / mask_strict.size

        if plant_ratio_full < 0.50:
            logger.info(f"[Stage 1] No YOLO, strict plant_ratio={plant_ratio_full:.2f} < 0.50 — no crop.")
            boxes_to_process = []
        else:
            logger.info(f"[Stage 1] No YOLO but strict plant_ratio={plant_ratio_full:.2f} — fallback whole-frame.")
            h, w = frame.shape[:2]
            boxes_to_process = [(0, 0, w, h, "leaf")]
            is_fallback = True
    else:
        boxes_to_process = []
        for (x1, y1, x2, y2, cls_name, _score) in boxes:
            boxes_to_process.append((x1, y1, x2, y2, cls_name))

    crop_found = False

    for x1, y1, x2, y2, region_type in boxes_to_process:
        roi = frame[y1:y2, x1:x2]
        if roi.size == 0:
            continue

        # ---- Skin-tone rejection ----------------------------------------
        # If the ROI is dominated by human skin pixels, it's a face/hand/arm
        # falsely detected as a plant region — discard it immediately.
        if _roi_is_skin_dominated(roi, skin_threshold=0.40):
            logger.info(f"[Stage 1] ROI ({x1},{y1})-({x2},{y2}) rejected: skin-tone dominated.")
            continue

        # ---- Per-ROI plant-pixel ratio check ----------------------------
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        mask_green  = cv2.inRange(hsv, np.array([35,  40,  40]), np.array([85, 255, 255]))
        mask_yellow = cv2.inRange(hsv, np.array([25,  40,  40]), np.array([35, 255, 255]))
        # Also include broader yellow-green (diseased leaves can be pale)
        mask_broad  = cv2.inRange(hsv, np.array([10,  20,  30]), np.array([90, 255, 255]))
        mask = cv2.bitwise_or(mask_green, mask_yellow)
        mask_broad  = cv2.medianBlur(mask_broad, 5)
        mask        = cv2.medianBlur(mask, 5)
        plant_ratio      = float(np.sum(mask > 0)) / mask.size
        plant_ratio_broad = float(np.sum(mask_broad > 0)) / mask_broad.size

        # Use strict mask for decision; broad mask for CNN masking fallback
        if is_fallback and plant_ratio_broad < 0.40:
            logger.info(f"[Stage 1] Fallback ROI rejected: broad_ratio={plant_ratio_broad:.2f}")
            continue

        # Non-fallback: require at least 25% green pixels in the strict mask
        if not is_fallback and plant_ratio < 0.25:
            logger.info(f"[Stage 1] ROI rejected: plant_ratio={plant_ratio:.2f} < 0.25")
            continue

        crop_found = True

        # =========================================================
        # STAGE 1 RESULT — Is this region a LEAF?
        # =========================================================
        is_leaf_region = _is_leaf_class(region_type)
        logger.info(f"[Stage 1] Region class='{region_type}' → is_leaf={is_leaf_region} "
                    f"plant_ratio={plant_ratio:.2f}")

        if not is_leaf_region:
            # Not a leaf — skip Stage 2 and return NOT_LEAF
            logger.info(f"[Stage 1] Not a leaf ({region_type}) — skipping disease classification.")
            not_leaf_reason = (
                f"Detected plant region is a '{region_type}', not a leaf. "
                "Please capture a clear image of a leaf for disease analysis."
            )
            results_list.append(LeafResult(
                detection_stage=1,
                is_leaf=False,
                not_leaf_reason=not_leaf_reason,
                leaf_detected=True,   # plant WAS detected, just not a leaf
                status="NOT_LEAF",
                label=f"PLANT_DETECTED_{region_type.upper()}",
                confidence=0.0,
                class_index=-1,
                plant_type=region_type.capitalize(),
                disease_name="",
                affected_part=region_type,
                category="unknown",
                treatment_hint="Reposition camera to focus on a leaf surface for disease detection.",
                severity="none",
                bbox=[x1, y1, x2, y2] if not (x1 == 0 and y1 == 0 and x2 == frame.shape[1] and y2 == frame.shape[0]) else None,
            ))
            continue

        # =========================================================
        # STAGE 2 — Leaf confirmed → CNN Ensemble disease classification
        # Run ALL CNN models, average their softmax distributions.
        # =========================================================
        logger.info(f"[Stage 2] Leaf confirmed — running CNN ensemble ({len(cnn_models)} model(s)).")

        # Use strict green mask for CNN masking
        if plant_ratio < 0.25:
            crop_region = roi.copy()
            status_hint = "MASKED_WEAK"
        else:
            masked = cv2.bitwise_and(roi, roi, mask=mask)
            crop_region = masked
            status_hint = None

        # CLAHE lighting normalisation
        lab = cv2.cvtColor(crop_region, cv2.COLOR_BGR2LAB)
        l, a, b_ch = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        lab = cv2.merge((clahe.apply(l), a, b_ch))
        crop_region = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

        tensor = preprocess(crop_region).to(device)

        # Get averaged probabilities across all CNN models
        all_probs: list = []
        with torch.no_grad():
            for cnn in cnn_models:
                p = torch.softmax(cnn(tensor), dim=1)[0]
                all_probs.append(p)
        avg_probs = torch.stack(all_probs).mean(dim=0)  # ensemble average
        conf, idx  = torch.max(avg_probs, 0)

        label     = CLASS_NAMES[idx.item()]
        conf_val  = float(conf)
        class_idx = idx.item()

        # Decision
        if "healthy" in label.lower():
            status = "HEALTHY"
        elif conf_val < 0.60:
            status = "UNCERTAIN"
        else:
            status = "DISEASED"

        # Discard extremely low-confidence fallback results
        if is_fallback and conf_val < 0.45:
            logger.info(f"[Stage 2] Fallback discarded: confidence {conf_val:.2f} < 0.45")
            crop_found = False
            continue

        if status_hint == "MASKED_WEAK" and status == "UNCERTAIN":
            status = "MASKED_WEAK"

        # Parse label
        parts = label.split("_", 1)
        plant_type   = parts[0] if len(parts) > 0 else label
        raw_disease  = parts[1] if len(parts) > 1 else label
        disease_name = raw_disease.replace("_", " ")

        info = get_disease_info(label)

        results_list.append(LeafResult(
            detection_stage=2,
            is_leaf=True,
            not_leaf_reason="",
            leaf_detected=True,
            status=status,
            label=label,
            confidence=conf_val,
            class_index=class_idx,
            plant_type=plant_type,
            disease_name=disease_name,
            affected_part=info["part"],
            category=info["category"],
            treatment_hint=info["treatment"],
            severity=info["severity"],
            bbox=[x1, y1, x2, y2] if not (x1 == 0 and y1 == 0 and x2 == frame.shape[1] and y2 == frame.shape[0]) else None,
        ))

    if not crop_found:
        results_list.append(LeafResult(
            detection_stage=1,
            is_leaf=False,
            not_leaf_reason="No plant or crop region detected in the image.",
            leaf_detected=False,
            status="NO_CROP",
            label="NO CROP REGION DETECTED",
            confidence=0.0,
            class_index=-1,
            plant_type="",
            disease_name="",
            affected_part="",
            category="unknown",
            treatment_hint="Ensure the image contains a leaf, crop, or plant part.",
            severity="none",
        ))

    return results_list



# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(device),
        "yolo_detectors": yolo_model_names,
        "cnn_classifiers": cnn_model_names,
        "total_models_loaded": len(yolo_detectors) + len(cnn_models),
        "classes": len(CLASS_NAMES),
        "mode": "agriculture_disease_detection",
        "pipeline": "two-stage: leaf-check (YOLO ensemble) → disease-classify (CNN ensemble)",
        "supported_targets": ["leaf", "stem", "fruit", "root", "whole plant", "soil"],
    }


@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest):
    t0 = time.time()

    try:
        frame = decode_image(req.image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    leaves = process_frame(frame)

    elapsed_ms = (time.time() - t0) * 1000
    return DetectResponse(
        leaves=leaves,
        total_leaves=sum(1 for lf in leaves if lf.leaf_detected),
        processing_time_ms=round(elapsed_ms, 1),
    )


@app.get("/disease-info/{label}")
def disease_info(label: str):
    """Return treatment & metadata for a specific disease label."""
    info = get_disease_info(label)
    return {"label": label, **info}


@app.get("/classes")
def get_classes():
    return {"total": len(CLASS_NAMES), "classes": CLASS_NAMES}


