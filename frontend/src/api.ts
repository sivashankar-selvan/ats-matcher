const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface KeywordItem {
  keyword: string;
  category: string; // e.g. "Cloud & DevOps" -- used to file a confirmed
  // keyword into the matching line of the resume's Skills section.
}

export interface AnalyzeResult {
  score: number;
  matched: KeywordItem[];
  missing: KeywordItem[];
}

export async function fetchDefaultResume(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/default-resume`);
  if (!res.ok) throw new Error("Could not load default resume.");
  const data = await res.json();
  return data.tex as string;
}

export async function analyzeResume(jdText: string, resumeTex: string): Promise<AnalyzeResult> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText, resume_tex: resumeTex }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Analysis failed.");
  }
  return res.json();
}

export async function rewriteBullet(bullet: string, keywords: string[]): Promise<string> {
  const res = await fetch(`${API_BASE}/api/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bullet, keywords }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Rewrite failed.");
  }
  const data = await res.json();
  return data.rewritten as string;
}

export async function saveApplication(
  tex: string,
  company: string,
  role: string,
  jdText: string,
  score: number
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/save-application`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tex, company, role, jd_text: jdText, score }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = typeof err.detail === "object" ? err.detail.message : err.detail;
    throw new Error(message || "Saving to Notion failed.");
  }
  const data = await res.json();
  return data.notion_url as string;
}

export async function compileResume(tex: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tex }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message =
      typeof err.detail === "object" ? err.detail.message : err.detail;
    throw new Error(message || "Compilation failed.");
  }
  return res.blob();
}
