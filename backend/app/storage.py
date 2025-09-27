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
    "scans": DATA_DIR / "scans.json",  # NEW
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