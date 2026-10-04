import base64
import requests
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROBOFLOW_API_KEY = "3BzfaU7BQCf8vQjZOUeG"
ROBOFLOW_URL = "https://serverless.roboflow.com/lejun06555-gmail-com/workflows/pill-tray-piece-counter-1791116795395"

def find_pills(data):
    if isinstance(data, list):
        for item in data:
            found = find_pills(item)
            if found: return found
    elif isinstance(data, dict):
        if "predictions" in data and isinstance(data["predictions"], list):
            if len(data["predictions"]) > 0 and "x" in data["predictions"][0]:
                return data["predictions"]
        for key, value in data.items():
            found = find_pills(value)
            if found: return found
    return []

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    height, width, _ = img.shape
    
    max_dim = 800
    scale = min(max_dim / width, max_dim / height)
    if scale < 1:
        # Track the exact dimensions sent to Roboflow
        rf_width = int(width * scale)
        rf_height = int(height * scale)
        img_resized = cv2.resize(img, (rf_width, rf_height), interpolation=cv2.INTER_AREA)
    else:
        rf_width = width
        rf_height = height
        img_resized = img

    _, encoded_img = cv2.imencode('.jpg', img_resized, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    base64_image = base64.b64encode(encoded_img).decode("utf-8")
    
    payload = {
        "inputs": {
            "image": {"type": "base64", "value": base64_image}
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ROBOFLOW_API_KEY}"
    }
    
    response = requests.post(ROBOFLOW_URL, json=payload, headers=headers)
    result = response.json()
    
    dots = []
    predictions_list = find_pills(result)
    
    print(f"\n--- SUCCESS! FOUND {len(predictions_list)} PILLS ---\n")
            
    for pred in predictions_list:
        if "x" in pred and "y" in pred:
            # Divide by rf_width and rf_height so the percentages map correctly on the frontend
            percent_x = (pred["x"] / rf_width) * 100
            percent_y = (pred["y"] / rf_height) * 100
            
            pill_class = pred.get("class", "Whole Pill")
            
            dots.append({
                "x": percent_x, 
                "y": percent_y, 
                "class": pill_class
            })
            
    return {"dots": dots}

class CorrectedDot(BaseModel):
    x: float
    y: float

class FeedbackPayload(BaseModel):
    image_filename: str
    corrected_dots: List[CorrectedDot]

@app.post("/feedback")
async def process_feedback(payload: FeedbackPayload):
    print(f"Received {len(payload.corrected_dots)} validated pills for {payload.image_filename}")
    return {"status": "success", "message": "Feedback received for model training."}