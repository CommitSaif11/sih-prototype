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
