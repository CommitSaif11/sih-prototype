# SIH Prototype (FastAPI + React)

End-to-end prototype for SIH25021 (QR-based traceability). This repo shows how to connect a Python FastAPI backend with a React (Vite) frontend, with Docker and CI.

## Stack
- Backend: Python 3.11+, FastAPI, Uvicorn, CORS, dotenv
- Frontend: React + Vite
- Dev: Docker Compose
- CI: GitHub Actions

## Quick Start (Local, without Docker)

1) Backend
   - cd backend
   - python -m venv .venv && source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
   - pip install -r requirements.txt
   - cp .env.example .env
   - python -m app.seed  # seeds JSON data files
   - uvicorn app.main:app --reload --port 8000
   - API: http://localhost:8000

2) Frontend
   - cd frontend
   - npm install
   - cp .env.example .env
   - npm run dev
   - UI: http://localhost:5173

The frontend reads API base from `VITE_API_BASE` in frontend/.env (default http://localhost:8000).

## Quick Start (Docker)

- docker compose up --build
- Frontend (Vite dev): http://localhost:5173
- Backend (FastAPI): http://localhost:8000
- Note: frontend calls backend via http://backend:8000 inside Docker (set in compose env).

## How it connects (React -> FastAPI)

- Frontend uses `fetch(`${VITE_API_BASE}/api/... )`.
- Backend enables CORS:
  - Local dev: allow http://localhost:5173
  - Docker: frontend container calls backend service name `backend`.
- Change `VITE_API_BASE` in `frontend/.env` if you deploy elsewhere.

## API Endpoints (MVP)

- GET /health
- GET /api/vendors
- GET /api/lots
- GET /api/items
- GET /api/inspections
- POST /api/inspections  { itemUid, date, inspector, result, notes }

Data is stored in JSON files under backend/data for simplicity.

## Structure

.
├─ backend
│  ├─ app
│  │  ├─ main.py
│  │  ├─ models.py
│  │  ├─ storage.py
│  │  ├─ seed.py
│  │  └─ __init__.py
│  ├─ data (created after seeding)
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ .env.example
├─ frontend
│  ├─ src
│  │  ├─ App.jsx
│  │  ├─ main.jsx
│  │  └─ api.js
│  ├─ index.html
│  ├─ package.json
│  ├─ Dockerfile
│  └─ .env.example
├─ .github/workflows/ci.yml
├─ docker-compose.yml
└─ .gitignore

## Next Steps for SIH25021

- Add QR generation/verification endpoints (uid/signature) and a web page to generate/print demo QRs.
- Add roles and auth (JWT) later; for demo we keep it open.
- Replace JSON storage with SQLite/Postgres.
- Add analytics (lot/vendor anomaly detection) and CSV/JSON exports for UDM/TMS.

## Commands

Backend:
- uvicorn app.main:app --reload --port 8000

Frontend:
- npm run dev
- npm run build
- npm run preview

## Environment

backend/.env
- ALLOWED_ORIGINS=http://localhost:5173
- PORT=8000

frontend/.env
- VITE_API_BASE=http://localhost:8000