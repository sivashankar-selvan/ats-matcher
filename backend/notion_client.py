"""
Optional integration: saves a snapshot of an application (compiled resume
PDF, the JD text, and match score) as a row in a Notion database, so the app
can double as a lightweight job-application tracker.

Disabled by default -- everything else in the app works with zero Notion
config. Enable by setting NOTION_API_KEY (a Notion internal integration
secret, from https://www.notion.so/my-integrations) and NOTION_DATABASE_ID
(the target database's id, after sharing that database with the integration)
in backend/.env.

Expected database schema -- create these properties yourself in Notion, and
the names must match exactly (case-sensitive):
  - Name          (title)
  - Company       (rich_text / "Text")
  - Role          (rich_text / "Text")
  - Match Score   (number)
  - Date Applied  (date)
  - Status        (select -- add options like Applied / Interview / Offer /
                    Rejected; the app always writes "Applied" for a new row)
  - Resume        (files & media)

The JD text itself is written into the page BODY (as paragraph blocks), not
a property, since Notion property values are far more length-limited than
page content blocks.
"""
import os
from datetime import date

import httpx

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

# Notion bumps this version string periodically. If every call below starts
# failing with a 400, check https://developers.notion.com/reference/versioning
# for the current value and update the default (or just set NOTION_VERSION
# in backend/.env without touching code).
NOTION_VERSION = os.getenv("NOTION_VERSION", "2026-03-11")

NOTION_API_BASE = "https://api.notion.com/v1"


class NotionError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(NOTION_API_KEY and NOTION_DATABASE_ID)


def _headers() -> dict:
    # Deliberately no Content-Type here -- the one JSON call sets it itself,
    # and the multipart upload call needs httpx to set its own boundary'd
    # Content-Type, which it won't do if we've already set one.
    return {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": NOTION_VERSION,
    }


def _chunk_text(text: str, size: int = 1900) -> list[str]:
    """Splits JD text into pieces under Notion's ~2000-char rich_text limit,
    one per paragraph block."""
    text = text.strip()
    if not text:
        return []
    return [text[i : i + size] for i in range(0, len(text), size)]


def save_application(
    *, company: str, role: str, score: float, jd_text: str, pdf_bytes: bytes
) -> str:
    """Uploads the PDF to Notion and creates a database row referencing it,
    with the JD text saved into the page body. Returns the new page's URL."""
    if not is_configured():
        raise NotionError(
            "Notion tracker is not configured. Set NOTION_API_KEY and "
            "NOTION_DATABASE_ID to enable it."
        )

    safe_name = f"{company} - {role}.pdf".replace("/", "-").strip(" -") or "resume.pdf"

    with httpx.Client(timeout=30.0) as client:
        # 1. Register a file upload slot.
        create_resp = client.post(
            f"{NOTION_API_BASE}/file_uploads",
            headers={**_headers(), "Content-Type": "application/json"},
            json={
                "mode": "single_part",
                "filename": safe_name,
                "content_type": "application/pdf",
            },
        )
        if create_resp.status_code != 200:
            raise NotionError(f"Notion file_uploads create failed: {create_resp.text[:500]}")
        file_upload = create_resp.json()
        upload_id = file_upload["id"]
        upload_url = file_upload["upload_url"]

        # 2. Send the actual PDF bytes to that slot.
        send_resp = client.post(
            upload_url,
            headers=_headers(),
            files={"file": (safe_name, pdf_bytes, "application/pdf")},
        )
        if send_resp.status_code != 200:
            raise NotionError(f"Notion file upload send failed: {send_resp.text[:500]}")

        # 3. Create the database row: PDF attached, JD text as page body.
        jd_blocks = [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]},
            }
            for chunk in _chunk_text(jd_text)
        ] or [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": "(no JD text saved)"}}]
                },
            }
        ]

        page_resp = client.post(
            f"{NOTION_API_BASE}/pages",
            headers={**_headers(), "Content-Type": "application/json"},
            json={
                "parent": {"database_id": NOTION_DATABASE_ID},
                "properties": {
                    "Name": {
                        "title": [{"type": "text", "text": {"content": f"{role} — {company}"}}]
                    },
                    "Company": {"rich_text": [{"type": "text", "text": {"content": company}}]},
                    "Role": {"rich_text": [{"type": "text", "text": {"content": role}}]},
                    "Match Score": {"number": score},
                    "Date Applied": {"date": {"start": date.today().isoformat()}},
                    "Status": {"select": {"name": "Applied"}},
                    "Resume": {
                        "files": [
                            {
                                "type": "file_upload",
                                "file_upload": {"id": upload_id},
                                "name": safe_name,
                            }
                        ]
                    },
                },
                # Notion caps children on page-create at 100 blocks.
                "children": jd_blocks[:100],
            },
        )
        if page_resp.status_code != 200:
            raise NotionError(f"Notion page create failed: {page_resp.text[:500]}")

        return page_resp.json().get("url", "")
