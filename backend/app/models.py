from pydantic import BaseModel
from typing import Optional
from datetime import date

class Vendor(BaseModel):
    id: str
    code: str
    name: str
    plantCode: Optional[str] = None
    contact: Optional[str] = None

class Lot(BaseModel):
    id: str
    vendorCode: str
    type: str  # ERC | PAD | LINER | SLEEPER
    lotCode: str
    mfgDate: date
    quantity: int

class Item(BaseModel):
    id: str
    uid: str
    lotId: str
    status: str = "manufactured"  # manufactured|received|installed|in-service|retired
    location: Optional[str] = None
    warrantyStart: Optional[date] = None
    warrantyEnd: Optional[date] = None

class Inspection(BaseModel):
    id: str
    itemUid: str
    date: date
    inspector: str
    result: str  # pass|fail|rework
    notes: Optional[str] = None

class Scan(BaseModel):
    id: str
    uid: str
    sig: Optional[str] = None
    valid: Optional[bool] = None
    raw: Optional[str] = None
    source: Optional[str] = None  # camera|upload|manual
    ts: str  # ISO timestamp