"""
แปลงข้อความ booking จาก LINE -> ไฟล์ .ics สำหรับ import เข้า Google Calendar

วิธีใช้:
    1. แปะข้อความ booking ลงในไฟล์ bookings.txt (วาง booking ต่อกันได้เลย หลาย booking ก็ได้)
    2. python line_to_ics.py
    3. ได้ไฟล์ bookings.ics -> import เข้า Google Calendar
       (Google Calendar > Settings > Import & export > เลือกไฟล์)

รูปแบบข้อความที่รองรับ (1 booking เริ่มที่คำว่า "BOOKING NO." เสมอ):

  format A (บรรทัดเดียว):
    BOOKING NO. 271382140 = ( ...แจ้งรถไปรับตู้ 2/6/2026 ) = LOAD 4/6/2026 = จำนวน 1 ตู้ โหลดอมตะ

  format B (หลายบรรทัด มี INVOICE NO.):
    BOOKING NO.49013513 (3X20" FCL)
    LOADING DATE = 05.06.2026
    INVOICE NO. 2THA2605106 = 1X20" FCL  โหลดที่สาขาปิ่นทอง
    ...

สมมติฐาน (ปรับได้):
    - วันที่ = วัน/เดือน/ปี ค.ศ. รองรับทั้ง / และ .  (4/6/2026, 05.06.2026)
    - event เป็นแบบทั้งวัน (all-day) ในวัน LOAD
    - 1 event ต่อ 1 booking
"""

import re
import sys
from datetime import date, timedelta

sys.stdout.reconfigure(encoding="utf-8")        # กัน UnicodeError บน Windows console (cp874)

INPUT_FILE = "bookings.txt"
OUTPUT_FILE = "bookings.ics"

# โหมด --push (ลง Google Calendar ตรงๆ)
CALENDAR_ID = "primary"                          # ปฏิทินปลายทาง (primary = ปฏิทินหลักของบัญชี)
SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
CRED_FILE = "credentials.json"                   # โหลดจาก Google Cloud Console
TOKEN_FILE = "token.json"                         # ระบบสร้างให้เองหลังอนุญาตครั้งแรก

# map คำไทย -> ชื่อสถานที่
LOCATION_MAP = {
    "อมตะ": "Amata",
    "ปิ่นทอง": "Pinthong",
    "โหลด 2 ที่": "Both location",
}

DATE_RE = r"\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}"

# token เลขที่ invoice: เลข(ไม่บังคับ) + ตัวอักษร>=2 + เลข เช่น 1THA2605019
INVOICE_RE = r"[0-9]*[A-Z]{2,}[0-9]{3,}"


def parse_date(raw):
    """'4 / 6/ 2026', '05.06.2026', '04-06-26' -> date(...)  (วัน/เดือน/ปี ค.ศ., ปี 2 หลัก = 20xx)"""
    d, m, y = (int(x) for x in re.split(r"[./-]", re.sub(r"\s+", "", raw)))
    if y < 100:
        y += 2000
    return date(y, m, d)


def count_containers(text):
    """จำนวนตู้รวม: หัว (3X20") > รวม NX20" ทุก invoice > รวม 'N ตู้'"""
    head = re.search(r"\(\s*(\d+)\s*X\s*\d+", text, re.IGNORECASE)
    if head:
        return head.group(1)
    x = [int(n) for n in re.findall(r"(\d+)\s*X\s*\d+", text, re.IGNORECASE)]
    if x:
        return str(sum(x))
    tu = [int(n) for n in re.findall(r"(\d+)\s*ตู้", text)]
    if tu:
        return str(sum(tu))
    return "?"


def parse_booking(text):
    """แยกข้อมูลจาก 1 บล็อก booking -> dict หรือ None ถ้า parse ไม่ได้"""
    booking_no = re.search(r"BOOKING\s*NO\.?\s*:?\s*([A-Za-z]*\d+)", text, re.IGNORECASE)
    load_date = re.search(rf"(?:LOAD(?:ING\s*DATE)?|โหลด)\s*[=:]?\s*({DATE_RE})", text, re.IGNORECASE)
    if not (booking_no and load_date):
        return None

    # เลขที่ invoice ทุกตัว (จับ token เอง ไม่พึ่งคำว่า "INVOICE NO.") ไม่ซ้ำ ไม่เอา booking no.
    invoices = []
    for tok in re.findall(INVOICE_RE, text):
        if tok != booking_no.group(1) and tok not in invoices:
            invoices.append(tok)

    # สถานที่ทั้งหมดที่พบ (ไม่ซ้ำ เรียงตามที่เจอใน text)
    locations = []
    for thai, eng in sorted(LOCATION_MAP.items(), key=lambda kv: text.find(kv[0])):
        if thai in text and eng not in locations:
            locations.append(eng)

    # วันแจ้งรถไปรับตู้ (ไม่บังคับ, มีเฉพาะ format A)
    pickup = re.search(rf"รับตู้.*?({DATE_RE})", text)

    return {
        "booking_no": booking_no.group(1),
        "load_date": parse_date(load_date.group(1)),
        "containers": count_containers(text),
        "locations": locations,
        "invoices": invoices,
        "pickup": re.sub(r"\s+", "", pickup.group(1)) if pickup else None,
    }


def event_parts(b):
    """ข้อมูลร่วมของ event (ใช้ทั้งโหมด .ics และ Calendar API)"""
    start = b["load_date"]
    end = start + timedelta(days=1)            # all-day: วันสิ้นสุด = วันถัดไป (exclusive)
    loc = "+".join(b["locations"]) if b["locations"] else "?"
    summary = f'[{loc}] Load {b["containers"]} ตู้ — BK {b["booking_no"]}'

    desc = [
        f'Booking No: {b["booking_no"]}',
        f'Location: {loc}',
        f'Total Container: {b["containers"]}',
    ]
    if b["invoices"]:
        desc.append("Invoice No: " + ", ".join(b["invoices"]))
    if b["pickup"]:
        desc.append(f'แจ้งรถรับตู้: {b["pickup"]}')
    return start, end, summary, desc


def build_event(b):
    """รูปแบบ VEVENT สำหรับไฟล์ .ics (escape newline เป็น \\n)"""
    start, end, summary, desc = event_parts(b)
    return "\n".join([
        "BEGIN:VEVENT",
        f'UID:{b["booking_no"]}@calendar-hook',
        "DTSTAMP:20260101T000000Z",
        f'DTSTART;VALUE=DATE:{start:%Y%m%d}',
        f'DTEND;VALUE=DATE:{end:%Y%m%d}',
        f"SUMMARY:{summary}",
        "DESCRIPTION:" + "\\n".join(desc),
        "END:VEVENT",
    ])


def build_api_event(b):
    """body สำหรับ Google Calendar API (iCalUID = booking no. -> รันซ้ำไม่สร้างซ้ำ)"""
    start, end, summary, desc = event_parts(b)
    return {
        "summary": summary,
        "description": "\n".join(desc),
        "start": {"date": f"{start:%Y-%m-%d}"},
        "end": {"date": f"{end:%Y-%m-%d}"},
        "iCalUID": f'{b["booking_no"]}@calendar-hook',
    }


def fold(line):
    """RFC5545: บรรทัดต้องไม่เกิน 75 octets — ถ้าเกินให้ตัดแล้วขึ้นบรรทัดใหม่นำด้วยช่องว่าง
    (ไม่ตัดกลางตัวอักษร UTF-8: นับเป็น byte แต่ตัดตามตัวอักษร)"""
    if len(line.encode("utf-8")) <= 75:
        return line
    chunks, cur = [], b""
    for ch in line:
        e = ch.encode("utf-8")
        limit = 75 if not chunks else 74        # บรรทัดต่อมีช่องว่างนำ 1 octet
        if len(cur) + len(e) > limit:
            chunks.append(cur)
            cur = e
        else:
            cur += e
    chunks.append(cur)
    return b"\r\n ".join(chunks).decode("utf-8")


def split_bookings(text):
    """ตัดข้อความเป็นบล็อก: ใช้เส้นคั่น '====' ก่อน ถ้าบล็อกไหนมีหลาย booking ค่อยแยกที่ 'BOOKING NO.'"""
    chunks = []
    for piece in re.split(r"(?m)^\s*={3,}\s*$", text):
        if len(re.findall(r"BOOKING\s*NO", piece, re.IGNORECASE)) > 1:
            chunks.extend(re.split(r"(?=BOOKING\s*NO)", piece, flags=re.IGNORECASE))
        else:
            chunks.append(piece)
    return [c.strip() for c in chunks if re.search(r"BOOKING\s*NO", c, re.IGNORECASE)]


def write_ics(bookings):
    lines = "\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//calendar-hook//TH",
        "CALSCALE:GREGORIAN",
        *(build_event(b) for b in bookings),
        "END:VCALENDAR",
    ]).split("\n")
    # fold ทุกบรรทัด แล้วเขียนด้วย CRLF ตรงๆ (newline='' กันไม่ให้ \n ถูกแปลงซ้ำเป็น \r\r\n)
    ics = "\r\n".join(fold(ln) for ln in lines) + "\r\n"
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="") as f:
        f.write(ics)
    print(f"\n✓ เขียน {len(bookings)} event ลง {OUTPUT_FILE} แล้ว")


def get_service():
    """เชื่อม Google Calendar API — ครั้งแรกเปิด browser ให้อนุญาต แล้วเซฟ token.json ไว้ใช้ต่อ"""
    import os
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CRED_FILE):
                print(f"ไม่พบ {CRED_FILE} — ดูวิธีสร้างใน SETUP_API.md (Google Cloud Console)")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CRED_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("calendar", "v3", credentials=creds)


def push_to_calendar(bookings):
    try:
        service = get_service()
    except ImportError:
        print("ยังไม่ได้ลง library — รัน: pip install google-api-python-client google-auth-oauthlib")
        sys.exit(1)

    for b in bookings:
        # import_ = idempotent ตาม iCalUID: รันซ้ำจะอัปเดต event เดิม ไม่สร้างใหม่
        service.events().import_(calendarId=CALENDAR_ID, body=build_api_event(b)).execute()
        print(f'  -> calendar: BK {b["booking_no"]}')
    print(f"\n✓ ส่ง {len(bookings)} event เข้า Google Calendar แล้ว")


def main():
    push = "--push" in sys.argv
    try:
        with open(INPUT_FILE, encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        print(f"ไม่พบไฟล์ {INPUT_FILE} — สร้างไฟล์แล้วแปะข้อความ booking")
        sys.exit(1)

    bookings, failed = [], []
    for chunk in split_bookings(text):
        b = parse_booking(chunk)
        if b:
            bookings.append(b)
            print(f'OK  BK {b["booking_no"]}  LOAD {b["load_date"]:%d/%m/%Y}  '
                  f'{b["containers"]} ตู้  @{"+".join(b["locations"]) or "?"}'
                  + (f'  inv:{len(b["invoices"])}' if b["invoices"] else ""))
        else:
            failed.append(chunk.splitlines()[0] if chunk.splitlines() else chunk)

    if failed:
        print(f"\n⚠ parse ไม่ได้ {len(failed)} booking:")
        for ln in failed:
            print(f"   {ln}")

    if not bookings:
        print("\nไม่มี event ที่สร้างได้")
        sys.exit(1)

    if push:
        push_to_calendar(bookings)
    else:
        write_ics(bookings)


if __name__ == "__main__":
    main()
