import os
import re
import base64
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from keyword_matcher import analyze, category_of
from latex_compiler import compile_tex_to_pdf, LatexCompileError
from notion_client import (
    save_application as save_application_to_notion,
    is_configured as notion_is_configured,
    NotionError,
)

# Load backend/.env (GEMINI_API_KEY, FRONTEND_ORIGIN, etc.) into the process
# environment. Without this, values in .env are silently ignored and
# os.getenv() below only ever sees real shell environment variables.
load_dotenv()

APP_DIR = Path(__file__).parent
DEFAULT_RESUME_PATH = APP_DIR / "data" / "default_resume.tex"

app = FastAPI(title="ATS Resume Matcher API")

# In dev, allow the Vite dev server; in prod, set FRONTEND_ORIGIN to your
# deployed frontend URL (e.g. https://your-app.vercel.app).
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    jd_text: str
    resume_tex: str | None = None  # falls back to the default resume if omitted


class KeywordItem(BaseModel):
    keyword: str
    category: str


class AnalyzeResponse(BaseModel):
    score: float
    matched: list[KeywordItem]
    missing: list[KeywordItem]


class CompileRequest(BaseModel):
    tex: str


class RewriteRequest(BaseModel):
    bullet: str
    keywords: list[str] = []


class SaveApplicationRequest(BaseModel):
    tex: str
    company: str
    role: str
    jd_text: str
    score: float


@app.get("/api/default-resume")
def get_default_resume() -> dict:
    if not DEFAULT_RESUME_PATH.exists():
        raise HTTPException(status_code=404, detail="No default resume configured yet.")
    return {"tex": DEFAULT_RESUME_PATH.read_text(encoding="utf-8")}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_resume(req: AnalyzeRequest) -> AnalyzeResponse:
    resume_tex = req.resume_tex or (
        DEFAULT_RESUME_PATH.read_text(encoding="utf-8") if DEFAULT_RESUME_PATH.exists() else ""
    )
    if not req.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is required.")
    result = analyze(req.jd_text, resume_tex)
    return AnalyzeResponse(
        score=result.score,
        matched=[KeywordItem(keyword=k, category=category_of(k)) for k in result.matched],
        missing=[KeywordItem(keyword=k, category=category_of(k)) for k in result.missing],
    )


@app.post("/api/compile")
def compile_resume(req: CompileRequest) -> Response:
    if not req.tex.strip():
        raise HTTPException(status_code=400, detail="tex is required.")
    try:
        pdf_bytes = compile_tex_to_pdf(req.tex)
    except LatexCompileError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc), "log": exc.log[-4000:]})
    return Response(content=pdf_bytes, media_type="application/pdf")


@app.post("/api/rewrite")
def rewrite_bullet(req: RewriteRequest) -> dict:
    """
    Optional helper: rewords a bullet point the user ALREADY WROTE so it
    surfaces real, existing work in the JD's terminology. It must not
    invent new experience, tools, or claims that aren't in the input bullet.

    Requires GEMINI_API_KEY to be set; returns 501 otherwise so the rest of
    the app (matching/compiling) works with zero API keys configured.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=501,
            detail="Rewrite is not configured. Set GEMINI_API_KEY to enable this optional feature.",
        )

    import httpx

    # Override with e.g. GEMINI_MODEL=gemini-3.5-pro in backend/.env if you
    # have paid API access and want a Pro model instead of the free-tier
    # Flash-Lite default. Google periodically retires older model ids
    # ("no longer available to new users") — if this default 404s, check
    # https://ai.google.dev/gemini-api/docs/models for the current name.
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    prompt = (
        "You will be given exactly ONE resume bullet point. It may be written in "
        "plain text, or in LaTeX (it may contain commands like \\textbf{...} for "
        "bold text) -- if it's LaTeX, preserve that markup style in your answer, "
        "moving or adding \\textbf{} around newly-relevant terms as appropriate; "
        "if it's plain text, answer in plain text.\n"
        "Reword it so it naturally uses this terminology where truthfully "
        "applicable: " + ", ".join(req.keywords) + ".\n"
        "Rules:\n"
        "- Treat the input as exactly one bullet, even if it spans more than one "
        "sentence or contains line breaks -- do not split it, and do not process "
        "it as if it were a list of multiple bullets.\n"
        "- Do not invent tools, metrics, or responsibilities that are not already "
        "present in the original bullet.\n"
        "- Keep the original meaning and roughly the original length.\n"
        "- Output ONLY the reworded bullet text itself. No preamble, no "
        "explanation, no notes in parentheses about what you excluded, no "
        "markdown formatting (no ** or *), no quotation marks around it.\n\n"
        f"Original bullet:\n{req.bullet}"
    )

    resp = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": api_key},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=20.0,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {resp.text[:500]}")

    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected Gemini API response shape.")

    return {"rewritten": _clean_rewrite_output(text)}


def _clean_rewrite_output(text: str) -> str:
    """
    Defense-in-depth against the model ignoring the "no commentary" rule:
    drops meta-commentary lines/notes and surrounding quote marks, in case a
    preamble ("Here is the reworded version...") or a trailing
    "(Note: ... excluded ...)" slips through despite the prompt.
    """
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    meta_prefixes = ("here is", "here's", "note:", "(note", "*(note", "since you", "sure,", "certainly")
    lines = [line for line in lines if not line.lower().lstrip("*").lstrip().startswith(meta_prefixes)]
    cleaned = " ".join(lines).strip()
    # Strip a trailing parenthetical note like "*(Note: AWS, Kafka excluded...)*"
    cleaned = re.sub(r"\s*\*?\((?:Note|note)[^)]*\)\*?\s*$", "", cleaned)
    # Strip stray markdown emphasis the model added despite being told not to.
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"(?<!\w)\*(.*?)\*(?!\w)", r"\1", cleaned)
    cleaned = cleaned.strip().strip('"').strip("'")
    return cleaned or text.strip()


@app.post("/api/save-application")
def save_application(req: SaveApplicationRequest) -> dict:
    """
    Optional job-application tracker: compiles the resume as submitted and
    logs it -- PDF, company, role, match score, and the full JD text -- as a
    new row in a Notion database. Requires NOTION_API_KEY and
    NOTION_DATABASE_ID; returns 501 otherwise so the rest of the app keeps
    working with zero Notion setup.
    """
    if not notion_is_configured():
        raise HTTPException(
            status_code=501,
            detail=(
                "Notion tracker is not configured. Set NOTION_API_KEY and "
                "NOTION_DATABASE_ID to enable it."
            ),
        )
    if not req.company.strip() or not req.role.strip():
        raise HTTPException(status_code=400, detail="Company and role are required.")

    try:
        pdf_bytes = compile_tex_to_pdf(req.tex)
    except LatexCompileError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc), "log": exc.log[-4000:]})

    try:
        notion_url = save_application_to_notion(
            company=req.company.strip(),
            role=req.role.strip(),
            score=req.score,
            jd_text=req.jd_text,
            pdf_bytes=pdf_bytes,
        )
    except NotionError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"notion_url": notion_url}


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
