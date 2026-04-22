from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from detection_server import router as detection_router
from field_boundary_server import router as boundary_router

app = FastAPI()

# ✅ ADD CORS FIRST (VERY IMPORTANT ORDER)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ THEN include routes
app.include_router(detection_router)
app.include_router(boundary_router)