import { useState } from "react";
import { AnalyzeResult, KeywordItem, extractJobInfo, saveApplication } from "../api";
import ExperienceRewriter from "./ExperienceRewriter";

interface Props {
  jdText: string;
  onJdChange: (value: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  result: AnalyzeResult | null;
  confirmedKeywords: KeywordItem[];
  onToggleConfirmed: (item: KeywordItem) => void;
  onApplyConfirmed: () => void;
  error: string | null;
  resumeTex: string;
  onApplyBulletRewrite: (fullMatch: string, newContent: string) => void;
}

export default function JDPanel({
  jdText,
  onJdChange,
  onAnalyze,
  analyzing,
  result,
  confirmedKeywords,
  onToggleConfirmed,
  onApplyConfirmed,
  error,
  resumeTex,
  onApplyBulletRewrite,
}: Props) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  async function handleAnalyzeClick() {
    onAnalyze();
    // Best-effort auto-fill of Company/Role from the JD text via Gemini --
    // runs alongside the main analyze call, never blocks or errors it out.
    // Only overwrites blank fields, so it won't clobber anything you've
    // already typed (e.g. if you're re-analyzing a tweaked JD).
    if (!company.trim() && !role.trim() && jdText.trim()) {
      setExtracting(true);
      try {
        const info = await extractJobInfo(jdText);
        if (info.company) setCompany(info.company);
        if (info.role) setRole(info.role);
      } catch {
        // Silent -- manual entry in the fields below still works fine.
      } finally {
        setExtracting(false);
      }
    }
  }

  async function handleSaveToNotion() {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    setSavedUrl(null);
    try {
      const url = await saveApplication(resumeTex, company, role, jdText, result.score);
      setSavedUrl(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Saving to Notion failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Job description</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Paste the JD, then Analyze.</p>
      </div>

      <textarea
        className="min-h-[220px] flex-1 resize-none rounded-md border border-gray-300 bg-white p-3 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        placeholder="Paste the job description here..."
        value={jdText}
        onChange={(e) => onJdChange(e.target.value)}
      />

      <button
        onClick={handleAnalyzeClick}
        disabled={analyzing || !jdText.trim()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {analyzing ? "Analyzing..." : "Analyze"}
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3 overflow-y-auto border-t border-gray-200 pt-3 dark:border-gray-700">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Match score</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.score}%</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2 rounded-full bg-blue-600 dark:bg-blue-500"
                style={{ width: `${Math.min(result.score, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Already covered ({result.matched.length})
            </h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {result.matched.map((kw) => (
                <span
                  key={kw.keyword}
                  title={kw.category}
                  className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-300"
                >
                  {kw.keyword}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Missing from your resume ({result.missing.length})
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Click "I have this" only for skills you can genuinely speak to in
              an interview — this adds them to the matching line of your Skills
              section (e.g. Kubernetes goes into "Cloud & DevOps"), clearly
              labeled as self-confirmed where no matching line exists. It
              never touches your work experience.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {result.missing.map((kw) => {
                const confirmed = confirmedKeywords.some((c) => c.keyword === kw.keyword);
                return (
                  <div
                    key={kw.keyword}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1 dark:border-gray-700"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {kw.keyword}
                      <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({kw.category})</span>
                    </span>
                    <button
                      onClick={() => onToggleConfirmed(kw)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        confirmed
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {confirmed ? "Added ✓" : "I have this"}
                    </button>
                  </div>
                );
              })}
              {result.missing.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500">No gaps found — nice.</p>
              )}
            </div>
            {confirmedKeywords.length > 0 && (
              <button
                onClick={onApplyConfirmed}
                className="mt-2 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Apply {confirmedKeywords.length} keyword
                {confirmedKeywords.length > 1 ? "s" : ""} to Skills section
              </button>
            )}
          </div>

          <ExperienceRewriter
            resumeTex={resumeTex}
            keywords={[...result.matched, ...result.missing].map((k) => k.keyword)}
            onApply={onApplyBulletRewrite}
          />

          <div className="flex flex-col gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <div>
              <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Save this application (optional)
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Compiles the resume as it stands right now and logs it -- PDF,
                company, role, match score, and the full JD text -- as a new
                row in your Notion tracker.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder={extracting ? "Detecting..." : "Company"}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <input
                className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder={extracting ? "Detecting..." : "Role"}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            {extracting && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Auto-detecting company &amp; role from the JD...
              </p>
            )}
            <button
              onClick={handleSaveToNotion}
              disabled={saving || !company.trim() || !role.trim()}
              className="self-start rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {saving ? "Saving..." : "Save to Notion"}
            </button>
            {saveError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {saveError}
                {saveError.toLowerCase().includes("not configured") && (
                  <>
                    {" "}
                    — add{" "}
                    <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">
                      NOTION_API_KEY
                    </code>{" "}
                    and{" "}
                    <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">
                      NOTION_DATABASE_ID
                    </code>{" "}
                    to{" "}
                    <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">
                      backend/.env
                    </code>{" "}
                    and restart the backend.
                  </>
                )}
              </p>
            )}
            {savedUrl && (
              <p className="text-sm text-green-700 dark:text-green-400">
                Saved ✓ —{" "}
                <a
                  href={savedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  view in Notion
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
