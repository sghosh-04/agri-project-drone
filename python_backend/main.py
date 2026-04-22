from fastapi import FastAPI
from detection_server import router as detection_router
from field_boundary_server import router as boundary_router

app = FastAPI(title="Agri Drone Backend")

app.include_router(detection_router)
app.include_router(boundary_router)