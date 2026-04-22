#!/usr/bin/env bash
# ============================================================
#  AgriDrone – Python Backend Launcher
# ============================================================
#  Starts BOTH backend servers:
#    • Plant Disease Detection   → http://localhost:8001
#    • Field Boundary Detection  → http://localhost:8002
#
#  Usage (from the project root):
#    bash python_backend/start_server.sh
#
#  To run only the detection server:
#    bash python_backend/start_server.sh --detection-only
#
#  To run only the field-boundary server:
#    bash python_backend/start_server.sh --boundary-only
# ============================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

VENV="$DIR/.venv"

# ---------- 1. Activate virtual environment ----------------
if [ -d "$VENV" ]; then
    echo "✅  Activating local virtual environment (.venv)"
    source "$VENV/bin/activate"
elif [ -d "$DIR/../../plant/.venv" ]; then
    echo "✅  Activating legacy /plant/.venv"
    source "$DIR/../../plant/.venv/bin/activate"
else
    echo "⚠️   No virtual environment found. Using system Python."
    echo "    Run: python3.11 -m venv python_backend/.venv && source python_backend/.venv/bin/activate"
fi

# ---------- 2. Ensure dependencies are up to date ----------
echo ""
echo "📦  Verifying Python dependencies..."
pip install -q -r "$DIR/requirements.txt"

# ---------- 3. Check model files ---------------------------
MODELS_DIR="$DIR/models"
LEAF_PT="$MODELS_DIR/best_leaf_only.pt"
CNN_PT="$MODELS_DIR/plant_cnn_model.pt"

echo ""
if [ -f "$LEAF_PT" ] && [ -f "$CNN_PT" ]; then
    echo "✅  Model files found in $MODELS_DIR"
    export LEAF_MODEL_PATH="$LEAF_PT"
    export CNN_MODEL_PATH="$CNN_PT"
else
    echo "⚠️   MODEL FILES MISSING"
    echo "    The plant-disease detection server requires two trained model files:"
    echo ""
    echo "      • best_leaf_only.pt   (YOLO v8 leaf detector)"
    echo "      • plant_cnn_model.pt  (PlantDiseaseCNN classifier)"
    echo ""
    echo "    Please copy them into:"
    echo "      $MODELS_DIR/"
    echo ""
    echo "    The detection server (port 8001) will NOT start until models are present."
    echo "    The field-boundary server (port 8002) will still start normally."
    echo ""
fi

# ---------- 4. Parse CLI arguments -------------------------
DETECTION_ONLY=false
BOUNDARY_ONLY=false

for arg in "$@"; do
    case $arg in
        --detection-only) DETECTION_ONLY=true ;;
        --boundary-only)  BOUNDARY_ONLY=true  ;;
    esac
done

# ---------- 5. Launch servers ------------------------------
cleanup() {
    echo ""
    echo "⛔  Stopping all Python backend processes..."
    kill $DETECTION_PID $BOUNDARY_PID 2>/dev/null || true
    wait $DETECTION_PID $BOUNDARY_PID 2>/dev/null || true
    echo "   Done."
}
trap cleanup EXIT INT TERM

echo ""
echo "============================================================"
echo "  AgriDrone Python Backend"
echo "============================================================"

DETECTION_PID=""
BOUNDARY_PID=""

# --- Plant Disease Detection Server (port 8001) ---
if [ "$BOUNDARY_ONLY" = false ]; then
    if [ -f "$LEAF_PT" ] && [ -f "$CNN_PT" ]; then
        echo ""
        echo "🌿  Starting Plant Disease Detection Server..."
        echo "    → http://localhost:8001"
        echo "    → http://localhost:8001/docs"
        LEAF_MODEL_PATH="$LEAF_PT" CNN_MODEL_PATH="$CNN_PT" \
            uvicorn detection_server:app --host 0.0.0.0 --port 8001 &
        DETECTION_PID=$!
    else
        echo ""
        echo "⏭️   Skipping detection server (model files missing)"
    fi
fi

# --- Field Boundary Detection Server (port 8002) ---
if [ "$DETECTION_ONLY" = false ]; then
    echo ""
    echo "🗺️   Starting Field Boundary Detection Server..."
    echo "    → http://localhost:8002"
    echo "    → http://localhost:8002/docs"
    uvicorn field_boundary_server:app --host 0.0.0.0 --port 8002 &
    BOUNDARY_PID=$!
fi

echo ""
echo "============================================================"
echo "  Press Ctrl+C to stop all servers"
echo "============================================================"
echo ""

# Wait for all background servers
wait
