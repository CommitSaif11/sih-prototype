#!/usr/bin/env bash
set -euo pipefail

echo "Scaffolding SIH prototype (FastAPI + React)..."

mkdir -p backend/app backend/data frontend/src .github/workflows

cat > .gitignore << 'EOF'
# Node
node_modules
npm-debug.log*
pnpm-debug.log*
yarn*.log

# Python
__pycache__/
*.pyc
.venv/
.env

# Build outputs
dist
.build
.cache

# Local env
frontend/.env
backend/.env

# Data
backend/data/*.json
!backend/data/.gitkeep
EOF

cat > docker-compose.yml << 'EOF'
version: "3.9"
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - PORT=8000
      - ALLOWED_ORIGINS=http://localhost:5173
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    command: sh -c "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_BASE=http://backend:8000
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
    command: sh -c "npm install && npm run dev -- --host 0.0.0.0"
EOF

cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: python -m pip install --upgrade pip
      - run: pip install -r requirements.txt
      - run: python -c "import fastapi, uvicorn, pydantic; print('Backend install OK')"

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
EOF

cat > backend/requirements.txt << 'EOF'
fastapi==0.115.0
uvicorn==0.30.6
python-dotenv==1.0.1
pydantic==2.9.2
EOF

cat > backend/.env.example << 'EOF'
ALLOWED_ORIGINS=http://localhost:5173
PORT=8000
EOF

cat > backend/app/__init__.py << 'EOF'
# Makes 'app' a package so 'python -m app.seed' works
EOF

cat > backend/app/models.py << 'EOF'
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
EOF

cat > backend/app/storage.py << 'EOF'
import json
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

FILES = {
    "vendors": DATA_DIR / "vendors.json",
    "lots": DATA_DIR / "lots.json",
    "items": DATA_DIR / "items.json",
    "inspections": DATA_DIR / "inspections.json",
}

def _ensure_file(path: Path):
    if not path.exists():
        path.write_text("[]", encoding="utf-8")

def read_all(name: str) -> List[Dict[str, Any]]:
    path = FILES[name]
    _ensure_file(path)
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def write_all(name: str, data: List[Dict[str, Any]]):
    path = FILES[name]
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def append(name: str, record: Dict[str, Any]):
    records = read_all(name)
    records.append(record)
    write_all(name, records)
EOF

cat > backend/app/seed.py << 'EOF'
# Seed demo data into backend/data/*.json
from datetime import date
from .storage import write_all

vendors = [
    {"id": "v_abc", "code": "ABC", "name": "ABC Metals", "plantCode": "PL-01"},
    {"id": "v_xyz", "code": "XYZ", "name": "XYZ Rail Components", "plantCode": "PL-19"},
]

lots = [
    {"id": "lot_erc_1", "vendorCode": "ABC", "type": "ERC", "lotCode": "L1234", "mfgDate": str(date(2025, 9, 1)), "quantity": 1000},
    {"id": "lot_pad_1", "vendorCode": "XYZ", "type": "PAD", "lotCode": "P9876", "mfgDate": str(date(2025, 8, 15)), "quantity": 750},
]

items = [
    {"id": "it_1", "uid": "IRFT-ERC-ABC-2509-L1234-000001", "lotId": "lot_erc_1", "status": "manufactured"},
    {"id": "it_2", "uid": "IRFT-ERC-ABC-2509-L1234-000002", "lotId": "lot_erc_1", "status": "manufactured"},
    {"id": "it_3", "uid": "IRFT-PAD-XYZ-2508-P9876-000001", "lotId": "lot_pad_1", "status": "manufactured"},
]

inspections = [
    {"id": "insp_1", "itemUid": "IRFT-ERC-ABC-2509-L1234-000001", "date": str(date(2025, 9, 26)), "inspector": "Vendor QA", "result": "pass", "notes": "Visual OK"},
]

def main():
    write_all("vendors", vendors)
    write_all("lots", lots)
    write_all("items", items)
    write_all("inspections", inspections)
    print("Seeded demo data.")

if __name__ == "__main__":
    main()
EOF

cat > backend/app/main.py << 'EOF'
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
EOF

cat > backend/Dockerfile << 'EOF'
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

: > backend/data/.gitkeep

cat > frontend/.env.example << 'EOF'
VITE_API_BASE=http://localhost:8000
EOF

cat > frontend/package.json << 'EOF'
{
  "name": "sih-prototype-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 5173"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
EOF

cat > frontend/index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>SIH Prototype</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat > frontend/src/main.jsx << 'EOF'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
EOF

cat > frontend/src/api.js << 'EOF'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}

export const api = {
  health: () => get('/health'),
  vendors: () => get('/api/vendors'),
  lots: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/lots${q ? `?${q}` : ''}`)
  },
  items: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/items${q ? `?${q}` : ''}`)
  },
  inspections: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/inspections${q ? `?${q}` : ''}`)
  },
  createInspection: (payload) => post('/api/inspections', payload),
}
EOF

cat > frontend/src/App.jsx << 'EOF'
import React, { useEffect, useState } from 'react'
import { api } from './api'

export default function App() {
  const [health, setHealth] = useState(null)
  const [vendors, setVendors] = useState([])
  const [lots, setLots] = useState([])
  const [items, setItems] = useState([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedLot, setSelectedLot] = useState('')
  const [inspections, setInspections] = useState([])
  const [form, setForm] = useState({ itemUid: '', date: '', inspector: '', result: 'pass', notes: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    api.health().then(setHealth).catch(console.error)
    api.vendors().then(setVendors).catch(console.error)
    api.lots().then(setLots).catch(console.error)
    api.items().then(setItems).catch(console.error)
  }, [])

  useEffect(() => {
    if (form.itemUid) {
      api.inspections({ itemUid: form.itemUid }).then(setInspections).catch(console.error)
    } else {
      setInspections([])
    }
  }, [form.itemUid])

  const filteredLots = selectedVendor ? lots.filter(l => l.vendorCode === selectedVendor) : lots
  const filteredItems = selectedLot ? items.filter(i => i.lotId === selectedLot) : items

  const handleCreateInspection = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      await api.createInspection(payload)
      const list = await api.inspections({ itemUid: form.itemUid })
      setInspections(list)
      alert('Inspection created')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem', maxWidth: 960 }}>
      <h1>SIH Prototype (FastAPI + React)</h1>

      <section>
        <h2>Health</h2>
        <pre>{health ? JSON.stringify(health, null, 2) : 'Loading...'}</pre>
        <small>API Base: {import.meta.env.VITE_API_BASE || 'http://localhost:8000'}</small>
      </section>

      <section>
        <h2>Browse Vendors, Lots, Items</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label>Vendor</label><br/>
            <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}>
              <option value="">All</option>
              {vendors.map(v => <option key={v.id} value={v.code}>{v.code} — {v.name}</option>)}
            </select>
          </div>
          <div>
            <label>Lot</label><br/>
            <select value={selectedLot} onChange={e => setSelectedLot(e.target.value)}>
              <option value="">All</option>
              {filteredLots.map(l => <option key={l.id} value={l.id}>{l.type}-{l.lotCode} ({l.vendorCode})</option>)}
            </select>
          </div>
        </div>

        <h3 style={{ marginTop: '1rem' }}>Items</h3>
        <ul>
          {filteredItems.map(i => (
            <li key={i.id}>
              <code>{i.uid}</code> — lot: {i.lotId} — status: {i.status}
              <button style={{ marginLeft: 8 }} onClick={() => setForm(f => ({ ...f, itemUid: i.uid }))}>
                Select for Inspection
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Create Inspection</h2>
        <form onSubmit={handleCreateInspection} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: 8 }}>
          <div>
            <label>Item UID</label><br/>
            <input value={form.itemUid} onChange={e => setForm({ ...form, itemUid: e.target.value })} placeholder="IRFT-..." />
          </div>
          <div>
            <label>Date</label><br/>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label>Inspector</label><br/>
            <input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="Depot QA" />
          </div>
          <div>
            <label>Result</label><br/>
            <select value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}>
              <option value="pass">pass</option>
              <option value="fail">fail</option>
              <option value="rework">rework</option>
            </select>
          </div>
          <div>
            <label>Notes</label><br/>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </div>
          <button type="submit" style={{ marginTop: 8 }}>Add Inspection</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>

        <h3 style={{ marginTop: '1rem' }}>Inspections for selected item</h3>
        <ul>
          {inspections.map(i => (
            <li key={i.id}>
              {i.date} — {i.inspector} — {i.result} — {i.notes || '-'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
EOF

cat > frontend/Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
EOF

cat > README.md << 'EOF'
# SIH Prototype (FastAPI + React)

End-to-end prototype for SIH25021 (QR-based traceability). This repo shows how to connect a Python FastAPI backend with a React (Vite) frontend, with Docker and CI.

## Quick Start

Backend:
- cd backend
- python -m venv .venv && source .venv/bin/activate
- pip install -r requirements.txt
- cp .env.example .env
- python -m app.seed
- uvicorn app.main:app --reload --port 8000

Frontend:
- cd frontend
- npm install
- cp .env.example .env
- npm run dev
- UI: http://localhost:5173

Docker:
- docker compose up --build
- API: http://localhost:8000
- UI: http://localhost:5173
EOF

echo "Done. Files created."
