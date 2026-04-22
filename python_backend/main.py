from fastapi import FastAPI
from detection_server import app as detection_app
from field_boundary_server import app as boundary_app

app = FastAPI()

# Merge routes from both apps
for route in detection_app.routes:
    app.router.routes.append(route)

for route in boundary_app.routes:
    app.router.routes.append(route)
