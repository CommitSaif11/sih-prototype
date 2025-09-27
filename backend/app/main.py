import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .models import Vendor, Lot, Item, Inspection
from . import storage

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
PORT = int(os.getenv("PORT", "8000"))

app = FastAPI(title="SIH Prototype API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.get("/api/vendors", response_model=List[Vendor])
def get_vendors():
    return storage.read_all("vendors")

@app.get("/api/lots", response_model=List[Lot])
def get_lots(vendorCode: Optional[str] = None, type: Optional[str] = None):
    lots = storage.read_all("lots")
    if vendorCode:
        lots = [l for l in lots if l["vendorCode"] == vendorCode]
    if type:
        lots = [l for l in lots if l["type"] == type]
    return lots

@app.get("/api/items", response_model=List[Item])
def get_items(lotId: Optional[str] = None):
    items = storage.read_all("items")
    if lotId:
        items = [i for i in items if i["lotId"] == lotId]
    return items

@app.get("/api/inspections", response_model=List[Inspection])
def get_inspections(itemUid: Optional[str] = None):
    ins = storage.read_all("inspections")
    if itemUid:
        ins = [i for i in ins if i["itemUid"] == itemUid]
    return ins

class InspectionCreate(BaseModel):
    itemUid: str
    date: str
    inspector: str
    result: str
    notes: Optional[str] = None

@app.post("/api/inspections", response_model=Inspection)
def create_inspection(payload: InspectionCreate):
    items = storage.read_all("items")
    if not any(i["uid"] == payload.itemUid for i in items):
        raise HTTPException(404, f"Item with uid {payload.itemUid} not found")
    new = {
        "id": f"insp_{int(datetime.utcnow().timestamp())}",
        "itemUid": payload.itemUid,
        "date": payload.date,
        "inspector": payload.inspector,
        "result": payload.result,
        "notes": payload.notes,
    }
    storage.append("inspections", new)
    return new
