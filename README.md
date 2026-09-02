# ATS Resume Matcher

Paste a job description on the left; the right side shows your LaTeX resume
with an Overleaf-style Source/PDF toggle. The left panel scores your resume
against the JD's keywords and shows what's missing. You can only add missing
keywords yourself, one at a time, to the Skills section (never to Experience)
by clicking "I have this" — the app never invents or edits your work history.

## How it works

- **Matching/scoring** (`backend/keyword_matcher.py`) is plain dictionary +
  regex matching against `backend/skills_dictionary.py`. No LLM, no API key,
  no rate limits — this is the core of the app and should always work.
- **LaTeX -> PDF** (`backend/latex_compiler.py`) shells out to the
  [Tectonic](https://tectonic-typesetting.github.io/) engine.
- **Optional bullet rewording** (`/api/rewrite`) calls Google's Gemini API
  (free tier) to reword a bullet you already wrote in the JD's terminology.
  It's disabled until you set `GEMINI_API_KEY`; nothing else depends on it.

## Local development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

You also need the `tectonic` binary on your PATH for `/api/compile` to work.
Install instructions: https://tectonic-typesetting.github.io/book/latest/installation/
(Everything else in the app works fine without it — only PDF preview needs it.)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. It talks to the backend at http://localhost:8000
by default (see `frontend/.env.example` to change that).

## Deploying

- **Frontend**: push `frontend/` to Vercel or Netlify (free). Set
  `VITE_API_BASE_URL` to your deployed backend's URL.
- **Backend**: deploy `backend/` (the Dockerfile included builds Tectonic in)
  to Render's free web service tier, or similar. Set `FRONTEND_ORIGIN` to
  your deployed frontend's URL for CORS, and `GEMINI_API_KEY` if you want the
  optional rewrite feature.

## Project layout

```
backend/
  main.py               FastAPI app (analyze / compile / rewrite endpoints)
  keyword_matcher.py     JD <-> resume keyword scoring
  skills_dictionary.py   Curated keyword list (extend this as you go)
  latex_compiler.py      tex -> pdf via Tectonic
  data/default_resume.tex  Your default resume (used when none is uploaded)
  Dockerfile
frontend/
  src/App.tsx             Two-pane layout wiring
  src/components/JDPanel.tsx     JD input + score + keyword gaps
  src/components/ResumePanel.tsx Overleaf-style Source/PDF toggle
  src/resumeEditor.ts     The one function that edits resume text (Skills only)
```

## A note on scope

This tool is meant to help you notice genuine keyword/phrasing gaps between
your resume and a JD, and to reword real experience in the JD's language.
It's deliberately built so it cannot fabricate work experience: the only
edit path (`insertAdditionalSkills` in `resumeEditor.ts`) only touches the
Skills section, and only after you've explicitly confirmed you have that
skill. Keep it that way — claiming experience you don't have on a resume
tends to surface badly in the interview it got you.
