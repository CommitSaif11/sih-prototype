import os
import hmac
import hashlib
import base64
from uuid import uuid4
from collections import Counter, defaultdict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from .models import Vendor, Lot, Item, Inspection
from . import storage

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
ALLOWED_ORIGIN_REGEX = os.getenv("ALLOWED_ORIGIN_REGEX", r"https://.*\.app\.github\.dev$")

app = FastAPI(title="SIH Prototype API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signing (demo-friendly HMAC-SHA256 truncated)
SIGNING_SECRET = os.getenv("SIGNING_SECRET", "dev-secret-change-me")

def sign_uid(uid: str) -> str:
    digest = hmac.new(SIGNING_SECRET.encode(), uid.encode(), hashlib.sha256).digest()
    # Short, URL-safe signature (base64url truncated to 16 bytes)
    sig = base64.urlsafe_b64encode(digest)[:16].decode().rstrip("=")
    return sig

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

# Core lists
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

# Lookup item by UID
@app.get("/api/items/by-uid", response_model=Item)
def get_item_by_uid(uid: str):
    items = storage.read_all("items")
    for it in items:
        if it["uid"] == uid:
            return it
    raise HTTPException(404, f"Item with uid {uid} not found")

# UID make/verify
class UIDMakePayload(BaseModel):
    type: str        # ERC|PAD|LINER|SLEEPER
    vendorCode: str  # e.g., ABC
    lotCode: str     # e.g., L1234
    yymm: str        # e.g., 2509
    ser: str         # e.g., 000001

class UIDResponse(BaseModel):
    uid: str
    sig: str

@app.post("/api/uid/make", response_model=UIDResponse)
def make_uid(payload: UIDMakePayload):
    t = payload.type.upper()
    uid = f"IRFT-{t}-{payload.vendorCode}-{payload.yymm}-{payload.lotCode}-{payload.ser}"
    sig = sign_uid(uid)
    return {"uid": uid, "sig": sig}

@app.get("/api/uid/verify")
def verify_uid(uid: str, sig: str):
    expected = sign_uid(uid)
    return {"valid": hmac.compare_digest(sig, expected), "expected": expected}

# ---------- Minimal "AI analytics" (heuristic) ----------
def compute_metrics() -> Dict[str, Any]:
    vendors = storage.read_all("vendors")
    lots = storage.read_all("lots")
    items = storage.read_all("items")
    inspections = storage.read_all("inspections")

    totals = {
        "vendors": len(vendors),
        "lots": len(lots),
        "items": len(items),
        "inspections": len(inspections),
    }

    # Items by status
    status_counts = Counter(i.get("status") or "unknown" for i in items)

    # Lots by type
    type_counts = Counter(l.get("type") or "unknown" for l in lots)

    # Inspections by result, pass/fail rate
    result_counts = Counter(i.get("result") or "unknown" for i in inspections)
    total_results = sum(result_counts.values())
    pass_rate = (result_counts.get("pass", 0) / total_results) if total_results else None
    fail_rate = (result_counts.get("fail", 0) / total_results) if total_results else None

    # Map lotId -> vendorCode for vendor analytics
    lot_vendor: Dict[str, str] = {l["id"]: l["vendorCode"] for l in lots}
    # Vendor -> inspections + fails
    vendor_inspections = defaultdict(int)
    vendor_fails = defaultdict(int)
    for ins in inspections:
        # find vendor via item -> lotId
        uid = ins.get("itemUid")
        if not uid:
            continue
        # find lotId from items list
        it = next((x for x in items if x["uid"] == uid), None)
        if not it:
            continue
        vcode = lot_vendor.get(it["lotId"], "UNK")
        vendor_inspections[vcode] += 1
        if ins.get("result") == "fail":
            vendor_fails[vcode] += 1

    leaderboard = []
    for vcode, cnt in vendor_inspections.items():
        fails = vendor_fails.get(vcode, 0)
        leaderboard.append({
            "vendorCode": vcode,
            "inspections": cnt,
            "failures": fails,
            "fail_rate": (fails / cnt) if cnt else 0.0
        })
    # Sort: highest fail rate, then most inspections
    leaderboard.sort(key=lambda x: (x["fail_rate"], x["inspections"]), reverse=True)

    # Warranty approaching expiry (within 30 days) — many seeds are null, so likely empty
    upcoming: List[Dict[str, Any]] = []
    now = datetime.utcnow().date()
    for it in items:
        wend = it.get("warrantyEnd")
        try:
            # If present as ISO date
            if isinstance(wend, str):
                wend_date = date.fromisoformat(wend)
            else:
                wend_date = None
        except Exception:
            wend_date = None
        if wend_date:
            days = (wend_date - now).days
            if 0 <= days <= 30:
                upcoming.append({"uid": it["uid"], "warrantyEndsInDays": days})
    upcoming.sort(key=lambda x: x["warrantyEndsInDays"])

    return {
        "generatedAt": datetime.utcnow().isoformat(),
        "totals": totals,
        "items_by_status": dict(status_counts),
        "lots_by_type": dict(type_counts),
        "inspections_by_result": dict(result_counts),
        "pass_rate": pass_rate,
        "fail_rate": fail_rate,
        "vendors_leaderboard": leaderboard,
        "warranty_upcoming": upcoming,
    }

def generate_insights(m: Dict[str, Any]) -> Dict[str, Any]:
    # Simple heuristic narrative to look "AI-ish" for demo
    totals = m.get("totals", {})
    pass_rate = m.get("pass_rate")
    fail_rate = m.get("fail_rate")
    leaderboard = m.get("vendors_leaderboard", [])
    items_by_status = m.get("items_by_status", {})
    lots_by_type = m.get("lots_by_type", {})

    lines = []
    lines.append(f"System has {totals.get('vendors',0)} vendors, {totals.get('lots',0)} lots, {totals.get('items',0)} items, and {totals.get('inspections',0)} inspections.")
    if pass_rate is not None:
        lines.append(f"Overall pass rate is {round(pass_rate*100,1)}%; fail rate {round((fail_rate or 0)*100,1)}%.")
    if leaderboard:
        top = leaderboard[0]
        if top["fail_rate"] > 0:
            lines.append(f"Highest risk vendor: {top['vendorCode']} (fail rate {round(top['fail_rate']*100,1)}% over {top['inspections']} inspections).")
    if items_by_status:
        biggest_status = max(items_by_status, key=items_by_status.get)
        lines.append(f"Most items are in '{biggest_status}' state ({items_by_status[biggest_status]}).")
    if lots_by_type:
        major_type = max(lots_by_type, key=lots_by_type.get)
        lines.append(f"Dominant production type: {major_type}.")

    # Suggested actions (rule-based)
    actions = []
    if fail_rate and fail_rate > 0.1:
        actions.append("Increase QA sampling for high-failure vendors and review supplier processes.")
    else:
        actions.append("Maintain current QA sampling; monitor weekly.")
    if items_by_status.get("manufactured",0) > 0 and items_by_status.get("received",0) == 0:
        actions.append("Plan inbound logistics to move manufactured items to receiving.")
    if m.get("warranty_upcoming"):
        soon = len(m["warranty_upcoming"])
        actions.append(f"{soon} items will exit warranty within 30 days; schedule preventive checks.")

    narrative = " ".join(lines) + (" Recommended actions: " + " ".join(actions))

    return {
        "generatedAt": m.get("generatedAt"),
        "insights": lines,
        "actions": actions,
        "narrative": narrative
    }

@app.get("/api/reports/metrics")
def reports_metrics():
    return compute_metrics()

@app.get("/api/reports/insights")
def reports_insights():
    m = compute_metrics()
    return generate_insights(m)