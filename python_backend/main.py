from fastapi import FastAPI
from detection_server import app as detection_app
from boundary_server import app as boundary_app

app = FastAPI()

app.mount("/detect", detection_app)
app.mount("/boundary", boundary_app)
