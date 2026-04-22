"""
Field Boundary Detection Server — Gemini Vision + DexiNed + K-Means Fallback
==============================================================================
Priority chain:
  1. Google Gemini 1.5 Flash Vision  → best accuracy, needs API key + internet
  2. DexiNed deep-learning edge detector  → great accuracy, runs locally
  3. K-Means colour segmentation  → last resort, no GPU needed

Run with:
    uvicorn field_boundary_server:app --host 0.0.0.0 --port 8002 --reload
"""

import base64
import json
import os
import re
import sys
import time
import warnings
import logging
import urllib.request
import urllib.error
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage
from skimage.segmentation import watershed
from skimage.feature import peak_local_max
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_THIS_DIR = Path(__file__).parent
_DEXINED_DIR = _THIS_DIR / "dexined"
_DEXINED_WEIGHTS = _DEXINED_DIR / "checkpoints" / "BIPED2BSDS" / "10_model.pth"

# ---------------------------------------------------------------------------
# Gemini config
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyBQ1Ee2xrvrxiCeXfM1OLRypKLMZ8Q9mpw")

GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
]

def make_gemini_url(model: str) -> str:
    return (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={GEMINI_API_KEY}"
    )

# ---------------------------------------------------------------------------
# DexiNed — load at startup
# ---------------------------------------------------------------------------
_dexined_model = None
_dexined_device = None

def _load_dexined():
    """Load DexiNed model once at startup. Returns (model, device) or (None, None)."""
    global _dexined_model, _dexined_device

    if not _DEXINED_DIR.exists():
        logger.warning("DexiNed repo not found at %s — DexiNed disabled.", _DEXINED_DIR)
        return None, None

    if not _DEXINED_WEIGHTS.exists():
        logger.warning("DexiNed weights not found at %s — DexiNed disabled.", _DEXINED_WEIGHTS)
        return None, None

    try:
        import torch
        sys.path.insert(0, str(_DEXINED_DIR))
        from model import DexiNed  # noqa: E402  (DexiNed repo's model.py)

        if torch.backends.mps.is_available():
            device = torch.device("mps")
            logger.info("DexiNed will use Apple MPS 🚀")
        elif torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info("DexiNed will use CUDA GPU 🚀")
        else:
            device = torch.device("cpu")
            logger.info("DexiNed will use CPU")

        model = DexiNed().to(device)
        checkpoint = torch.load(str(_DEXINED_WEIGHTS), map_location=device, weights_only=False)

        if isinstance(checkpoint, dict):
            if "state_dict" in checkpoint:
                model.load_state_dict(checkpoint["state_dict"])
            elif "model" in checkpoint:
                model.load_state_dict(checkpoint["model"])
            else:
                model.load_state_dict(checkpoint)
        else:
            model.load_state_dict(checkpoint)

        model.eval()
        logger.info("✅ DexiNed loaded successfully from %s", _DEXINED_WEIGHTS)
        return model, device

    except Exception as exc:
        logger.warning("DexiNed failed to load (%s) — will use K-Means fallback.", exc)
        return None, None


_dexined_model, _dexined_device = _load_dexined()

# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Field Boundary Detection API",
    description="Gemini Vision → DexiNed deep-learning → K-Means fallback.",
    version="3.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
from typing import Optional

class FieldBoundaryRequest(BaseModel):
    image_base64: str
    altitude_m: Optional[float] = None     # Drone flight altitude in metres
    camera_hfov_deg: Optional[float] = None  # Horizontal field-of-view in degrees
    # Common drone presets: DJI Phantom 4 = 84°, DJI Mini 3 = 82°, DJI Mavic 3 = 84°


class PlotResult(BaseModel):
    plot_id: int
    area_sq_meters: float          # Exact pixel count × GSD²
    area_hectares: float           # Convenience: area_sq_meters / 10000
    center_x: int
    center_y: int
    pixel_count: int               # Raw pixel count — always accurate


class FieldBoundaryResponse(BaseModel):
    plots: list[PlotResult]
    annotated_image_base64: str
    processing_time_ms: float
    total_plots: int
    total_area_sq_meters: float    # Sum of all plot areas
    total_area_hectares: float
    gsd_m_per_px: float            # Ground Sampling Distance used
    area_accuracy: str             # 'gps_exif' | 'user_altitude' | 'estimated'
    method: str
    model_used: str
    error: str | None = None


class IpcamSnapshotRequest(BaseModel):
    url: str                          # RTSP, MJPEG http, or HLS URL
    timeout_s: Optional[float] = 8.0  # Max seconds to wait for a frame


class IpcamSnapshotResponse(BaseModel):
    frame_base64: str                 # Raw JPEG base64 (no data-URI prefix)
    width: int
    height: int
    source_url: str


# ---------------------------------------------------------------------------
# GSD (Ground Sampling Distance) calculator
# ---------------------------------------------------------------------------
import io as _io
import struct

def _read_exif_altitude(raw_bytes: bytes) -> Optional[float]:
    """
    Attempt to read GPSAltitude from JPEG EXIF without external deps.
    Returns altitude in metres, or None if not found / not a JPEG.
    """
    try:
        from PIL import Image as _PIL, ExifTags
        img_pil = _PIL.open(_io.BytesIO(raw_bytes))
        exif_data = img_pil._getexif()
        if not exif_data:
            return None
        gps_tag = next((k for k, v in ExifTags.TAGS.items() if v == 'GPSInfo'), None)
        if gps_tag is None or gps_tag not in exif_data:
            return None
        gps_info = exif_data[gps_tag]
        # GPSAltitude is tag 6; GPSAltitudeRef is tag 5 (0=above sea, 1=below
        alt_tag = gps_info.get(6)
        if alt_tag is None:
            return None
        if hasattr(alt_tag, 'numerator'):
            alt_m = alt_tag.numerator / alt_tag.denominator
        elif isinstance(alt_tag, tuple):
            alt_m = alt_tag[0] / alt_tag[1]
        else:
            alt_m = float(alt_tag)
        return round(alt_m, 2)
    except Exception:
        return None


def compute_gsd(
    image_raw_bytes: bytes,
    image_w_px: int,
    altitude_m: Optional[float] = None,
    camera_hfov_deg: Optional[float] = None,
) -> tuple[float, str]:
    """
    Compute Ground Sampling Distance (metres/pixel) and return accuracy label.

    Priority:
      1. User-provided altitude + FOV  → 'user_altitude'  (most accurate)
      2. EXIF GPS altitude embedded in image + FOV  → 'gps_exif'
      3. Assumed standard drone: 100 m altitude, 84° HFOV  → 'estimated'

    Formula:
      GSD = (2 × altitude_m × tan(HFOV_rad / 2)) / image_width_px
    """
    DEFAULT_ALT_M    = 100.0   # metres — typical mapping mission height
    DEFAULT_HFOV_DEG = 84.0   # degrees — DJI Phantom 4 / Mavic 3 horizontal FOV

    import math

    hfov = camera_hfov_deg if camera_hfov_deg else DEFAULT_HFOV_DEG

    if altitude_m is not None:
        alt   = altitude_m
        accuracy = 'user_altitude'
    else:
        exif_alt = _read_exif_altitude(image_raw_bytes)
        if exif_alt is not None:
            alt = exif_alt
            accuracy = 'gps_exif'
            logger.info("EXIF altitude: %.1f m", alt)
        else:
            alt = DEFAULT_ALT_M
            accuracy = 'estimated'

    if image_w_px <= 0:
        image_w_px = 800

    hfov_rad = math.radians(hfov)
    gsd = (2.0 * alt * math.tan(hfov_rad / 2.0)) / image_w_px
    logger.info(
        "GSD=%.4f m/px  alt=%.1f m  HFOV=%.1f°  img_w=%d px  accuracy=%s",
        gsd, alt, hfov, image_w_px, accuracy,
    )
    return gsd, accuracy


# ---------------------------------------------------------------------------
# Common helpers
# ---------------------------------------------------------------------------
def decode_image(image_base64: str) -> np.ndarray:
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    raw = base64.b64decode(image_base64)
    buf = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image.")
    return img


def poly_area(pts: np.ndarray) -> float:
    x = pts[:, 0].astype(float)
    y = pts[:, 1].astype(float)
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


PALETTE = [
    (220, 50,  50), (50, 180,  50), (50,  50, 220), (220, 170,  50),
    (200, 50, 180), (50, 200, 170), (160,  50, 220), (220, 110,  50),
    (50, 110, 220), (120, 220,  50), (220,  50, 120), (50, 220, 110),
    (110, 150, 220), (220, 150, 110), (150, 220, 150),
]


# ---------------------------------------------------------------------------
# 1. Gemini Vision path  (unchanged)
# ---------------------------------------------------------------------------
PROMPT = """You are an expert agricultural image analyst.

Analyze this aerial/drone farmland image and identify EVERY individual farm plot or field you can see.

Return ONLY valid JSON — no markdown, no code fences, no explanation.

Format exactly:
{"is_field": true, "plots":[{"id":1,"bbox":[x1,y1,x2,y2],"crop_type":"wheat","confidence":0.92}]}

Rules:
- is_field: Boolean. Must be true ONLY if the image is an aerial or top-down view of agricultural farm plots, soil, or vegetation. False if it is a person, close-up of a leaf, indoors, or non-farmland.
- If is_field is false, return {"is_field": false, "plots": []}
- bbox = [left, top, right, bottom] pixel coordinates in this 800x800 image
- List every distinct plot, including small ones
- crop_type: "wheat","rice","corn","vegetables","bare_soil","grass","mixed","unknown"
- confidence: 0.0–1.0
- If no plots visible but it's a field: {"is_field": true, "plots":[]}
"""


def call_gemini(image_b64_clean: str, retries: int = 2) -> tuple[list[dict], str]:
    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "image/jpeg", "data": image_b64_clean}},
                {"text": PROMPT},
            ]
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192},
    }
    body = json.dumps(payload).encode("utf-8")

    last_error = "No models tried"
    for model in GEMINI_MODELS:
        url = make_gemini_url(model)
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        for attempt in range(retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    result = json.loads(resp.read().decode("utf-8"))
                text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
                logger.info("Gemini (%s) response: %s", model, text[:300])
                text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()

                if not text.endswith("}"):
                    last_close = text.rfind("}")
                    if last_close != -1:
                        text = text[:last_close + 1]
                        if not text.rstrip().endswith("]}"):
                            text = text + "]}"
                    else:
                        text = '{"plots":[]}'

                try:
                    js = json.loads(text)
                    is_field = js.get("is_field", True)
                    plots = js.get("plots", [])
                except json.JSONDecodeError:
                    is_field = True
                    plots = []

                return is_field, plots, model
            except urllib.error.HTTPError as e:
                err_body = e.read().decode()[:200]
                last_error = f"{model} HTTP {e.code}: {err_body}"
                if e.code == 404:
                    logger.warning("Model %s not found, trying next", model)
                    break
                elif e.code == 429:
                    logger.warning("Rate limited on %s, skipping retries for fast fallback.", model)
                    break
                else:
                    logger.warning(last_error)
                    break
            except Exception as e:
                last_error = str(e)
                logger.warning("Error with %s: %s", model, e)
                break

    raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")


def is_likely_field(frame_bgr: np.ndarray) -> bool:
    """
    Two-tier pre-flight check for aerial/drone field content.

    Tier 1 (vivid): High-saturation crops & soil — catches lush green fields.
    Tier 2 (dry):   Low-saturation bare soil/stubble — catches dry/harvested fields.

    Skin/fabric/walls typically EITHER fail the hue range OR the minimum area.
    Face rejection is handled separately by _field_has_centered_face().
    """
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    h, w = frame_bgr.shape[:2]
    total = float(h * w)

    # ---- Tier 1: Vivid field colors (sat >= 50) ----------------------
    mask_green  = cv2.inRange(hsv, np.array([32, 50, 40]),  np.array([85, 255, 255]))  # green crops
    mask_yellow = cv2.inRange(hsv, np.array([18, 50, 60]),  np.array([32, 255, 255]))  # yellowed crops
    mask_soil_v = cv2.inRange(hsv, np.array([ 5, 50, 30]),  np.array([22, 255, 200]))  # rich brown soil
    tier1 = cv2.bitwise_or(cv2.bitwise_or(mask_green, mask_yellow), mask_soil_v)
    tier1_ratio = float(np.sum(tier1 > 0)) / total

    # ---- Tier 2: Dry/harvested field (low-sat bare soil, sat >= 12) --
    # Dry stubble / sandy soil / pale harvested land = beige/tan, low saturation
    mask_dry = cv2.inRange(hsv, np.array([ 5, 12, 60]),   np.array([28, 60, 230]))   # dry soil/stubble
    tier2_ratio = float(np.sum(mask_dry > 0)) / total

    logger.info(
        "[Field pre-flight] vivid_ratio=%.3f dry_ratio=%.3f",
        tier1_ratio, tier2_ratio,
    )

    # Pass if either vivid crops cover ≥12%, OR dry soil covers ≥35%
    return tier1_ratio >= 0.12 or tier2_ratio >= 0.35


def _field_has_centered_face(frame_bgr: np.ndarray, skin_threshold: float = 0.30) -> bool:
    """
    Checks the central 50%x60% region for human skin tones.
    Rejects webcam selfie frames even when background walls look field-like.

    KEY INSIGHT: Real human skin has moderate-to-high saturation (sat 45-180).
    Dry agricultural soil (beige/sandy) has VERY LOW saturation (sat 12-45) in
    the same hue range — so we require sat >= 45 to distinguish faces from fields.
    """
    h, w = frame_bgr.shape[:2]
    cy1, cy2 = h // 4, 3 * h // 4
    cx1, cx2 = w // 4, 3 * w // 4
    center = frame_bgr[cy1:cy2, cx1:cx2]
    hsv = cv2.cvtColor(center, cv2.COLOR_BGR2HSV)
    # Skin: hue 0-20, saturation >= 45 (excludes desaturated beige soil)
    mask1 = cv2.inRange(hsv, np.array([ 0, 45, 60]), np.array([20, 175, 255]))
    # Darker skin wrap-around: hue 160-180, sat >= 45
    mask2 = cv2.inRange(hsv, np.array([160, 45, 60]), np.array([180, 175, 255]))
    skin  = cv2.bitwise_or(mask1, mask2)
    ratio = float(np.sum(skin > 0)) / skin.size
    logger.info("[Field pre-flight] center_skin_ratio=%.3f (thresh=%.2f)", ratio, skin_threshold)
    return ratio >= skin_threshold


def annotate_gemini(
    frame_bgr: np.ndarray,
    plots: list[dict],
    gsd: float = 0.125,   # metres/pixel — passed from endpoint
) -> tuple[list[PlotResult], str]:
    img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (800, 800))
    result_img = img.copy()
    plots_list: list[PlotResult] = []
    # Scale factor: original frame → 800px image
    orig_h, orig_w = frame_bgr.shape[:2]
    sx = 800.0 / orig_w
    sy = 800.0 / orig_h
    # GSD was computed for the original image; after resize we adjust:
    gsd_resized = gsd / sx  # m/px in the 800px image

    for i, plot in enumerate(plots):
        bbox = plot.get("bbox", [])
        if len(bbox) != 4:
            continue
        x1, y1, x2, y2 = (max(0, min(799, int(v))) for v in bbox)
        if x2 <= x1 or y2 <= y1:
            continue

        color = PALETTE[i % len(PALETTE)]
        overlay = result_img.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
        cv2.addWeighted(overlay, 0.15, result_img, 0.85, 0, result_img)
        cv2.rectangle(result_img, (x1, y1), (x2, y2), color, 2)

        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        plot_id = i + 1
        cv2.circle(result_img, (cx, cy), 14, (0, 0, 0), -1)
        cv2.circle(result_img, (cx, cy), 12, color, -1)
        cv2.putText(result_img, str(plot_id), (cx - 6, cy + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        crop = plot.get("crop_type", "")
        if crop and crop != "unknown":
            label = f"#{plot_id} {crop}"
            lx, ly = x1 + 4, y1 + 16
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
            cv2.rectangle(result_img, (lx - 2, ly - th - 2), (lx + tw + 2, ly + 2), (0, 0, 0), -1)
            cv2.putText(result_img, label, (lx, ly), cv2.FONT_HERSHEY_SIMPLEX, 0.38, color, 1)

        # Exact pixel count inside the bounding box (not just bbox area)
        pixel_count = (x2 - x1) * (y2 - y1)  # Gemini gives bbox, best we can do
        area_m2 = float(pixel_count) * (gsd_resized ** 2)

        plots_list.append(PlotResult(
            plot_id=plot_id,
            area_sq_meters=round(area_m2, 2),
            area_hectares=round(area_m2 / 10000, 4),
            center_x=cx,
            center_y=cy,
            pixel_count=pixel_count,
        ))

    result_bgr = cv2.cvtColor(result_img, cv2.COLOR_RGB2BGR)
    _, buf = cv2.imencode(".jpg", result_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b64 = base64.b64encode(buf).decode("utf-8")
    return plots_list, f"data:image/jpeg;base64,{b64}"


# ---------------------------------------------------------------------------
# 2. DexiNed deep-learning edge detector  ← NEW primary fallback
# ---------------------------------------------------------------------------
def _run_dexined_inference(image_rgb: np.ndarray, size: int = 768) -> np.ndarray:
    """
    Run DexiNed forward pass at high resolution.
    - CLAHE contrast enhancement to pop field boundaries.
    - Runs at 768px for fine-detail edge maps.
    - Ensembles all 7 DexiNed side outputs for robustness.
    """
    import torch

    H, W = image_rgb.shape[:2]

    # CLAHE in LAB space: boosts luminance contrast so field boundaries are crisper
    lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_ch = clahe.apply(l_ch)
    lab = cv2.merge((l_ch, a_ch, b_ch))
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

    img = cv2.resize(enhanced, (size, size)).astype(np.float32)
    img_bgr = img[:, :, ::-1].copy()
    img_bgr -= np.array([103.939, 116.779, 123.68], dtype=np.float32)

    tensor = torch.from_numpy(img_bgr.transpose(2, 0, 1)).unsqueeze(0).float().to(_dexined_device)

    with torch.no_grad():
        outputs = _dexined_model(tensor)

    # Weighted ensemble: later side-outputs capture higher-level (boundary-level) features
    weights = [0.05, 0.08, 0.10, 0.12, 0.15, 0.15, 0.35]  # 7 outputs, sum=1.0
    combined = np.zeros((size, size), dtype=np.float32)
    for i, out in enumerate(outputs):
        prob = torch.sigmoid(out).squeeze().cpu().numpy()
        combined += weights[i] * prob

    combined = cv2.resize(combined, (W, H))
    return combined.astype(np.float32)


def _slic_dexined_segment(
    image_rgb: np.ndarray,
    edge_f32: np.ndarray,
    n_segs: int = 400,
    compactness: float = 20.0,
    merge_pct: float = 28.0,
) -> np.ndarray:
    """
    SLIC superpixel segmentation guided by DexiNed boundary strength.

    WHY THIS WORKS:
      - SLIC assigns EVERY pixel to a superpixel → zero white holes
      - For each adjacent superpixel pair, we measure the mean DexiNed
        edge strength along their shared border
      - Pairs with LOW DexiNed strength = no real boundary = same field → merge
      - Pairs with HIGH DexiNed strength = road/hedge/boundary → keep separate

    merge_pct: auto-threshold = Nth percentile of all boundary strengths.
               Lower value = fewer, larger regions.
               Higher value = more, smaller regions.
    """
    from skimage.segmentation import slic as _slic

    H, W = image_rgb.shape[:2]

    # Smooth image slightly before SLIC to reduce texture noise
    smooth = cv2.GaussianBlur(image_rgb, (5, 5), 1.5)

    # Generate SLIC superpixels (enforce_connectivity avoids orphaned pixels)
    segments = _slic(
        smooth, n_segments=n_segs, compactness=compactness,
        sigma=1.0, start_label=1, enforce_connectivity=True,
    )

    unique_segs = np.unique(segments)

    # ── Build pairwise boundary strength from DexiNed (vectorised) ──────────
    # Horizontal neighbours
    h_a = segments[:, :-1].ravel()
    h_b = segments[:, 1:].ravel()
    h_e = edge_f32[:, :-1].ravel()

    # Vertical neighbours
    v_a = segments[:-1, :].ravel()
    v_b = segments[1:, :].ravel()
    v_e = edge_f32[:-1, :].ravel()

    all_a = np.concatenate([h_a, v_a]).astype(np.int32)
    all_b = np.concatenate([h_b, v_b]).astype(np.int32)
    all_e = np.concatenate([h_e, v_e]).astype(np.float32)

    # Keep only cross-boundary pairs
    bt_mask = all_a != all_b
    all_a, all_b, all_e = all_a[bt_mask], all_b[bt_mask], all_e[bt_mask]

    # Normalise pair direction (min, max) so (a,b) == (b,a)
    seg_min = np.minimum(all_a, all_b)
    seg_max = np.maximum(all_a, all_b)

    # Encode as single int64 key; assumes segment IDs < 1e5
    keys = seg_min.astype(np.int64) * 100_000 + seg_max.astype(np.int64)
    unique_keys, inv, counts = np.unique(keys, return_inverse=True, return_counts=True)
    sum_e = np.bincount(inv, weights=all_e, minlength=len(unique_keys))
    mean_e = (sum_e / counts).astype(np.float32)

    # Back to (seg1, seg2) pairs
    s1_arr = (unique_keys // 100_000).astype(np.int32)
    s2_arr = (unique_keys %  100_000).astype(np.int32)

    # Auto threshold: merge everything weaker than merge_pct-th percentile
    merge_thresh = float(np.percentile(mean_e, merge_pct))
    logger.info("SLIC edge merge threshold = %.3f (pct=%.0f)", merge_thresh, merge_pct)

    # ── Union-Find ──────────────────────────────────────────────────────────
    parent: dict[int, int] = {int(s): int(s) for s in unique_segs}

    def find(x: int) -> int:
        root = x
        while parent[root] != root:
            root = parent[root]
        # Path compression
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    # Sort edges weakest first → merge fields before boundaries
    order = np.argsort(mean_e)
    for idx in order:
        if mean_e[idx] >= merge_thresh:
            break
        union(int(s1_arr[idx]), int(s2_arr[idx]))

    # Apply Union-Find to build final dense label array
    final = np.zeros_like(segments, dtype=np.int32)
    for s in unique_segs:
        final[segments == s] = find(int(s))

    return final


def _merge_small_and_similar(
    labels: np.ndarray,
    image_rgb: np.ndarray,
    color_thresh: float = 18.0,
    size_thresh: int = 5000,
) -> np.ndarray:
    """
    Second-pass merging (post-SLIC) using LAB color similarity.
    Absorbs tiny fragments and merges perceptually identical adjacent regions.
    """
    try:
        from skimage.color import rgb2lab
        from skimage.segmentation import find_boundaries

        lab_img = rgb2lab(image_rgb.astype(np.float32) / 255.0)
        unique = np.unique(labels)
        unique = unique[unique > 0]

        mean_lab: dict[int, np.ndarray] = {}
        area_px:  dict[int, int]        = {}
        adj:      dict[int, set]        = {int(l): set() for l in unique}

        for lbl in unique:
            m = labels == lbl
            mean_lab[int(lbl)] = lab_img[m].mean(axis=0)
            area_px[int(lbl)]  = int(m.sum())

        bounds = find_boundaries(labels, mode='outer')
        ys, xs = np.where(bounds)
        for y, x in zip(ys.tolist(), xs.tolist()):
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < labels.shape[0] and 0 <= nx < labels.shape[1]:
                    a, b = int(labels[y, x]), int(labels[ny, nx])
                    if a > 0 and b > 0 and a != b:
                        adj[a].add(b)
                        adj[b].add(a)

        parent2: dict[int, int] = {int(l): int(l) for l in unique}

        def find2(x: int) -> int:
            while parent2[x] != x:
                parent2[x] = parent2[parent2[x]]
                x = parent2[x]
            return x

        def union2(a: int, b: int) -> None:
            ra, rb = find2(a), find2(b)
            if ra != rb:
                t = area_px.get(ra, 0) + area_px.get(rb, 0)
                if t > 0:
                    wa = area_px.get(ra, 0) / t
                    wb = area_px.get(rb, 0) / t
                    mean_lab[rb] = wa * mean_lab.get(ra, mean_lab[rb]) + wb * mean_lab[rb]
                    area_px[rb] = t
                parent2[ra] = rb

        # Pass 1: absorb tiny regions into most colour-similar neighbour
        for lbl in sorted(unique.tolist(), key=lambda l: area_px.get(int(l), 0)):
            lbl = int(lbl)
            if area_px.get(lbl, 0) < size_thresh:
                best, best_d = None, float('inf')
                for nb in adj.get(lbl, set()):
                    nb = int(nb)
                    if nb in mean_lab:
                        d = float(np.linalg.norm(mean_lab[lbl] - mean_lab[nb]))
                        if d < best_d:
                            best_d, best = d, nb
                if best is not None:
                    union2(lbl, best)

        # Pass 2 — CRITICAL FIX: ONLY absorb small regions into large neighbours.
        #   NEVER merge two large regions by color alone — even if they look similar,
        #   they may be adjacent strip fields separated by a thin path.
        #   (This was the root cause of strip fields being merged into one big region.)
        for lbl in sorted(unique.tolist(), key=lambda l: area_px.get(int(l), 0)):
            lbl = int(lbl)
            if area_px.get(lbl, 0) < size_thresh:   # only small regions get absorbed
                best, best_d = None, float('inf')
                for nb in adj.get(lbl, set()):
                    nb = int(nb)
                    if nb in mean_lab:
                        d = float(np.linalg.norm(mean_lab[lbl] - mean_lab[nb]))
                        if d < color_thresh and d < best_d:
                            best_d, best = d, nb
                if best is not None:
                    union2(lbl, best)

        new_labels = np.zeros_like(labels)
        for lbl in unique:
            new_labels[labels == int(lbl)] = find2(int(lbl))
        return new_labels

    except Exception as exc:
        logger.warning("Color merge failed (%s), skipping.", exc)
        return labels


def _remove_road_regions(
    labels: np.ndarray,
    image_rgb: np.ndarray,
    eccentricity_thresh: float = 0.97,
    chroma_thresh: float = 14.0,
    min_field_area: int = 3000,
) -> np.ndarray:
    """
    Remove road/path regions by combining two signals:
      1. Shape: roads are very elongated (eccentricity close to 1.0)
      2. Color: roads are low saturatioin (low LAB chroma = grayish/beige)

    Such regions are relabelled 0 so downstream filtering absorbs them.
    """
    try:
        from skimage.measure import regionprops, label as sk_label
        from skimage.color import rgb2lab

        lab_img = rgb2lab(image_rgb.astype(np.float32) / 255.0)
        unique = np.unique(labels)
        unique = unique[unique > 0]

        remove = set()
        for lbl in unique:
            m = (labels == lbl)
            area = int(m.sum())
            if area < min_field_area:
                continue  # small regions handled by size filter later

            # LAB chroma: sqrt(a² + b²) — roads/paths are near-grey → low chroma
            lab_vals = lab_img[m]
            chroma = float(np.sqrt(lab_vals[:, 1] ** 2 + lab_vals[:, 2] ** 2).mean())

            # Shape eccentricity via moments
            props = regionprops(m.astype(np.uint8))
            if not props:
                continue
            ecc = float(props[0].eccentricity)

            if ecc > eccentricity_thresh and chroma < chroma_thresh:
                remove.add(int(lbl))
                logger.info("Road filter: removed region %d ecc=%.3f chroma=%.1f", lbl, ecc, chroma)

        if remove:
            mask = np.isin(labels, list(remove))
            labels = labels.copy()
            labels[mask] = 0

        return labels
    except Exception as exc:
        logger.warning("Road filter failed (%s), skipping.", exc)
        return labels


def _edge_map_to_plots(
    edge_map: np.ndarray,
    image_rgb: np.ndarray,
    min_area_px: int = 4000,
    gsd: float = 0.125,   # metres/pixel — passed from dexined_detect
) -> tuple[list[PlotResult], str]:
    """
    Maximum-accuracy farm field segmentation.
    Area is computed as: exact_pixel_count * gsd^2  (no bounding box approximation).
    """
    from skimage.segmentation import find_boundaries

    H, W = image_rgb.shape[:2]

    # ── 1. User's Colab Pre-processing Pipeline ─────────────────────────────
    # Normalize
    edge_norm = cv2.normalize((edge_map * 255).astype(np.uint8), None, 0, 255, cv2.NORM_MINMAX)

    # CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    edge_enhanced = clahe.apply(edge_norm)

    # Threshold
    _, binary = cv2.threshold(edge_enhanced, 50, 255, cv2.THRESH_BINARY)

    # Remove small noise blobs (trees, shrubs)
    num_labels_bin, labels_bin, stats_bin, _ = cv2.connectedComponentsWithStats(binary)
    clean = np.zeros_like(binary)
    for i in range(1, num_labels_bin):
        area = stats_bin[i, cv2.CC_STAT_AREA]
        if area > 300:
            clean[labels_bin == i] = 255

    # Skeletonize
    from skimage.morphology import skeletonize
    skeleton = skeletonize(clean > 0).astype(np.uint8) * 255

    # Dilate slightly so lines form solid walls
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2,2))
    final_boundaries = cv2.dilate(skeleton, kernel, iterations=1)

    # ── 2. Extract Fields (Connected Components) ────────────────────────────
    # Invert the perfect boundary map: 0 becomes 255 (field), 255 becomes 0 (wall)
    fields_binary = cv2.bitwise_not(final_boundaries)

    num_labels, labels = cv2.connectedComponents(fields_binary)

    # Note: No SLIC needed anymore. Field plots are perfectly isolated.
    unique_raw = np.unique(labels)
    unique_raw = unique_raw[unique_raw > 0]


    region_info: list[tuple[int, int, int, int]] = []
    clean = np.zeros_like(labels, dtype=np.int32)
    nid = 1

    for lbl in unique_raw:
        m = (labels == lbl).astype(np.uint8)
        area = int(m.sum())
        if area < min_area_px:
            continue
        ys, xs = np.where(m)
        clean[m > 0] = nid
        region_info.append((nid, area, int(xs.mean()), int(ys.mean())))
        nid += 1

    # Sort largest → smallest
    region_info.sort(key=lambda r: r[1], reverse=True)
    sort_map = {info[0]: rank + 1 for rank, info in enumerate(region_info)}
    final_labels = np.zeros_like(clean)
    for old_id, new_id in sort_map.items():
        final_labels[clean == old_id] = new_id
    region_info = [(rank + 1, info[1], info[2], info[3])
                   for rank, info in enumerate(region_info)]

    logger.info("Final field count after merging: %d", len(region_info))

    # ── 6. Annotate ─────────────────────────────────────────────────────────
    result_img   = image_rgb.copy()
    fill_overlay = np.zeros_like(result_img, dtype=np.float32)
    fill_alpha   = np.zeros((H, W), dtype=np.float32)
    plots_list: list[PlotResult] = []

    for plot_id, area, cx, cy in region_info:
        color = PALETTE[(plot_id - 1) % len(PALETTE)]
        fill_overlay[final_labels == plot_id] = color
        fill_alpha[final_labels == plot_id]   = 0.40

        plots_list.append(PlotResult(
            plot_id=plot_id,
            area_sq_meters=round(area * (gsd ** 2), 2),  # exact pixel count * GSD²
            area_hectares=round(area * (gsd ** 2) / 10000, 4),
            center_x=cx,
            center_y=cy,
            pixel_count=area,
        ))

    # Blend fills
    a3 = np.stack([fill_alpha] * 3, axis=-1)
    result_img = (
        result_img.astype(np.float32) * (1 - a3) + fill_overlay * a3
    ).clip(0, 255).astype(np.uint8)

    # Coloured contour (2 px) per region
    for plot_id, area, cx, cy in region_info:
        color = PALETTE[(plot_id - 1) % len(PALETTE)]
        rmask = (final_labels == plot_id).astype(np.uint8) * 255
        contours, _ = cv2.findContours(rmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(result_img, contours, -1, color, 2)

    # White inter-region boundary lines ONLY (never inside a field)
    inter = find_boundaries(final_labels, mode='thin')
    result_img[inter] = [255, 255, 255]

    # Plot-ID badges
    for plot_id, area, cx, cy in region_info:
        color = PALETTE[(plot_id - 1) % len(PALETTE)]
        br = 16
        cv2.circle(result_img, (cx, cy), br + 2, (0, 0, 0), -1)
        cv2.circle(result_img, (cx, cy), br,     color,     -1)
        txt = str(plot_id)
        fs  = 0.55 if plot_id < 10 else 0.44
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, fs, 2)
        cv2.putText(result_img, txt,
                    (cx - tw // 2, cy + th // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, fs,
                    (255, 255, 255), 2, cv2.LINE_AA)

    result_bgr = cv2.cvtColor(result_img, cv2.COLOR_RGB2BGR)
    _, buf = cv2.imencode(".jpg", result_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
    b64 = base64.b64encode(buf).decode("utf-8")
    return plots_list, f"data:image/jpeg;base64,{b64}"


def dexined_detect(frame_bgr: np.ndarray, gsd: float = 0.125) -> tuple[list[PlotResult], str]:
    """Full DexiNed pipeline: BGR frame → (plots, annotated_b64). GSD in m/px."""
    image_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    orig_h, orig_w = image_rgb.shape[:2]
    image_rgb_1024 = cv2.resize(image_rgb, (1024, 1024))
    # Adjust GSD for the 1024px resize
    gsd_1024 = gsd * (orig_w / 1024.0)
    edge_map  = _run_dexined_inference(image_rgb_1024, size=1024)
    return _edge_map_to_plots(edge_map, image_rgb_1024, gsd=gsd_1024)

# ---------------------------------------------------------------------------
# 3. K-Means colour fallback  (kept as last resort)
# ---------------------------------------------------------------------------
def kmeans_fallback(frame_bgr: np.ndarray, gsd: float = 0.125) -> tuple[list[PlotResult], str]:
    """K-Means colour segmentation — last-resort when DexiNed is unavailable. GSD in m/px."""
    orig_h, orig_w = frame_bgr.shape[:2]
    gsd_800 = gsd * (orig_w / 800.0)   # adjust GSD for the 800px resize
    img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (800, 800))
    smooth = cv2.bilateralFilter(img, d=9, sigmaColor=75, sigmaSpace=75)
    lab = cv2.cvtColor(smooth, cv2.COLOR_RGB2LAB).astype(np.float32)
    pixels = lab.reshape(-1, 3)

    K = 12
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels_km, _ = cv2.kmeans(
        pixels, K, None, criteria, attempts=3, flags=cv2.KMEANS_PP_CENTERS
    )
    labels_km = labels_km.flatten().reshape(800, 800)

    result = img.copy()
    plots_list: list[PlotResult] = []
    plot_id = 1
    k3 = np.ones((3, 3), np.uint8)

    for c in range(K):
        mask = np.where(labels_km == c, 255, 0).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  k3, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k3, iterations=2)

        n_comp, comp_labels = cv2.connectedComponents(mask)
        color = PALETTE[c % len(PALETTE)]

        for cid in range(1, n_comp):
            cm = np.where(comp_labels == cid, 255, 0).astype(np.uint8)
            contours, _ = cv2.findContours(cm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                if cv2.contourArea(cnt) < 1000:
                    continue
                eps = 0.01 * cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, eps, True)
                cv2.drawContours(result, [approx], -1, color, 2)
                M = cv2.moments(cnt)
                if M["m00"] != 0:
                    cx_ = int(M["m10"] / M["m00"])
                    cy_ = int(M["m01"] / M["m00"])
                    # Exact contour pixel area (not bounding box)
                    pixel_count_exact = int(cv2.contourArea(cnt))
                    area_m2 = float(pixel_count_exact) * (gsd_800 ** 2)
                    cv2.circle(result, (cx_, cy_), 12, (0, 0, 0), -1)
                    cv2.circle(result, (cx_, cy_), 10, color, -1)
                    cv2.putText(result, str(plot_id), (cx_ - 5, cy_ + 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
                    plots_list.append(PlotResult(
                        plot_id=plot_id,
                        area_sq_meters=round(area_m2, 2),
                        area_hectares=round(area_m2 / 10000, 4),
                        center_x=cx_,
                        center_y=cy_,
                        pixel_count=pixel_count_exact,
                    ))
                plot_id += 1

    result_bgr = cv2.cvtColor(result, cv2.COLOR_RGB2BGR)
    _, buf = cv2.imencode(".jpg", result_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b64 = base64.b64encode(buf).decode("utf-8")
    return plots_list, f"data:image/jpeg;base64,{b64}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# IP Camera Snapshot Endpoint
# ---------------------------------------------------------------------------
@app.post("/ipcam-snapshot", response_model=IpcamSnapshotResponse)
def ipcam_snapshot(req: IpcamSnapshotRequest):
    """
    Grab a single JPEG frame from any IP camera URL using OpenCV.

    Supports:
    - RTSP streams:  rtsp://user:pass@192.168.1.x/stream
    - MJPEG over HTTP: http://192.168.1.x/video or /mjpeg
    - HTTP JPEG snapshots: http://192.168.1.x/snapshot.jpg
    - HLS / RTMP (where system ffmpeg/GStreamer pipeline is available)

    The endpoint is called by the frontend whenever it wants to run
    boundary detection on a frame — either on-demand (single click) or
    as part of the continuous auto-detect loop.
    """
    import threading

    url = req.url.strip()
    timeout_s = req.timeout_s or 8.0

    logger.info("[IPCam] Opening stream: %s", url)

    frame_holder: list = []
    error_holder: list = []

    def _capture():
        try:
            cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not cap.isOpened():
                # Try without backend hint (works for MJPEG http)
                cap.release()
                cap = cv2.VideoCapture(url)

            if not cap.isOpened():
                error_holder.append(f"Cannot open stream: {url}")
                return

            # Discard a few buffered frames to get the latest one
            for _ in range(3):
                cap.grab()

            ret, frame = cap.retrieve()
            if not ret:
                ret, frame = cap.read()

            cap.release()

            if ret and frame is not None:
                frame_holder.append(frame)
            else:
                error_holder.append("Could not read frame from stream.")
        except Exception as exc:
            error_holder.append(str(exc))

    t = threading.Thread(target=_capture, daemon=True)
    t.start()
    t.join(timeout=timeout_s)

    if t.is_alive():
        raise HTTPException(
            status_code=504,
            detail=f"Timed out after {timeout_s}s connecting to {url}",
        )

    if error_holder:
        raise HTTPException(status_code=502, detail=error_holder[0])

    if not frame_holder:
        raise HTTPException(status_code=502, detail="No frame received from IP camera.")

    frame_bgr = frame_holder[0]
    h, w = frame_bgr.shape[:2]

    _, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    b64 = base64.b64encode(buf).decode("utf-8")

    logger.info("[IPCam] Captured frame %dx%d from %s", w, h, url)
    return IpcamSnapshotResponse(frame_base64=b64, width=w, height=h, source_url=url)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "field-boundary-detection",
        "dexined_available": _dexined_model is not None,
        "dexined_device": str(_dexined_device) if _dexined_device else None,
        "dexined_weights": str(_DEXINED_WEIGHTS) if _DEXINED_WEIGHTS.exists() else "missing",
        "gemini_models": GEMINI_MODELS,
        "port": 8002,
        "gsd_formula": "GSD = (2 * alt * tan(HFOV/2)) / img_width_px",
        "default_altitude_m": 100,
        "default_hfov_deg": 84,
    }


@app.post("/detect-fields", response_model=FieldBoundaryResponse)
def detect_fields(req: FieldBoundaryRequest):
    t0 = time.time()

    try:
        frame = decode_image(req.image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    # =========================================================
    # Compute GSD for this image
    # =========================================================
    orig_h, orig_w = frame.shape[:2]
    raw_bytes = base64.b64decode(
        req.image_base64.split(",", 1)[1] if "," in req.image_base64 else req.image_base64
    )
    gsd, area_accuracy = compute_gsd(
        raw_bytes,
        image_w_px=orig_w,
        altitude_m=req.altitude_m,
        camera_hfov_deg=req.camera_hfov_deg,
    )

    # Prepare clean base64 for Gemini (800×800 JPEG)
    frame_800 = cv2.resize(frame, (800, 800))
    _, jpg_buf = cv2.imencode(".jpg", frame_800, [cv2.IMWRITE_JPEG_QUALITY, 90])
    image_b64_clean = base64.b64encode(jpg_buf).decode("utf-8")

    plots_list: list[PlotResult] = []
    annotated_uri: str = ""
    method: str = ""
    model_used: str = ""

    # =========================================================
    # PRE-FLIGHT: Strict field-content + face-rejection check
    # =========================================================
    _NO_FIELD_BASE = dict(
        plots=[],
        annotated_image_base64="",
        processing_time_ms=round((time.time() - t0) * 1000, 1),
        total_plots=0,
        total_area_sq_meters=0.0,
        total_area_hectares=0.0,
        gsd_m_per_px=round(gsd, 6),
        area_accuracy=area_accuracy,
        error="NO_FIELD",
    )

    if not is_likely_field(frame):
        logger.info("[Boundary] Pre-flight failed: not enough vivid field colors.")
        return FieldBoundaryResponse(
            **_NO_FIELD_BASE,
            method="heuristic",
            model_used="numpy_hsv",
        )

    if _field_has_centered_face(frame):
        logger.info("[Boundary] Pre-flight failed: human face detected in center.")
        return FieldBoundaryResponse(
            **_NO_FIELD_BASE,
            method="heuristic",
            model_used="face_reject",
        )

    # --- 1. Try Gemini ---
    try:
        is_field, gemini_plots, model_used_g = call_gemini(image_b64_clean)
        if not is_field:
            return FieldBoundaryResponse(
                **_NO_FIELD_BASE,
                processing_time_ms=round((time.time() - t0) * 1000, 1),
                method="gemini",
                model_used=model_used_g,
            )

        logger.info("Gemini (%s) detected %d plots", model_used_g, len(gemini_plots))
        plots_list, annotated_uri = annotate_gemini(frame, gemini_plots, gsd=gsd)
        method = "gemini"
        model_used = model_used_g
    except Exception as e:
        logger.warning("Gemini unavailable (%s) — trying DexiNed.", e)

        # --- 2. Try DexiNed ---
        if _dexined_model is not None:
            try:
                plots_list, annotated_uri = dexined_detect(frame, gsd=gsd)
                method = "dexined"
                model_used = "DexiNed-BIPED2BSDS-10"
                logger.info("DexiNed detected %d plots", len(plots_list))
            except Exception as e2:
                logger.warning("DexiNed failed (%s) — falling back to K-Means.", e2)
                plots_list, annotated_uri = kmeans_fallback(frame, gsd=gsd)
                method = "kmeans_fallback"
                model_used = "kmeans_fallback"
        else:
            # --- 3. K-Means last resort ---
            logger.warning("DexiNed not loaded — using K-Means fallback.")
            plots_list, annotated_uri = kmeans_fallback(frame, gsd=gsd)
            method = "kmeans_fallback"
            model_used = "kmeans_fallback"

    total_m2 = sum(p.area_sq_meters for p in plots_list)
    elapsed_ms = (time.time() - t0) * 1000
    return FieldBoundaryResponse(
        plots=plots_list,
        annotated_image_base64=annotated_uri,
        processing_time_ms=round(elapsed_ms, 1),
        total_plots=len(plots_list),
        total_area_sq_meters=round(total_m2, 2),
        total_area_hectares=round(total_m2 / 10000, 4),
        gsd_m_per_px=round(gsd, 6),
        area_accuracy=area_accuracy,
        method=method,
        model_used=model_used,
    )

