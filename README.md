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
