import { useEffect, useState } from "react";
import JDPanel from "./components/JDPanel";
import ResumePanel from "./components/ResumePanel";
import ThemeToggle from "./components/ThemeToggle";
import { AnalyzeResult, KeywordItem, analyzeResume, compileResume, fetchDefaultResume } from "./api";
import { insertAdditionalSkills } from "./resumeEditor";
import { applyBulletRewrite } from "./bulletParser";
import { useTheme } from "./useTheme";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [resumeTex, setResumeTex] = useState("");
  const [loadingResume, setLoadingResume] = useState(true);

  const [jdText, setJdText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [confirmedKeywords, setConfirmedKeywords] = useState<KeywordItem[]>([]);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  useEffect(() => {
    fetchDefaultResume()
      .then(setResumeTex)
      .catch(() => setResumeTex("% Could not load a default resume.\n% Paste your own LaTeX here."))
      .finally(() => setLoadingResume(false));
  }, []);

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisError(null);
    setConfirmedKeywords([]);
    try {
      const result = await analyzeResume(jdText, resumeTex);
      setAnalysisResult(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleConfirmed(item: KeywordItem) {
    setConfirmedKeywords((prev) =>
      prev.some((k) => k.keyword === item.keyword)
        ? prev.filter((k) => k.keyword !== item.keyword)
        : [...prev, item]
    );
  }

  function applyConfirmed() {
    if (confirmedKeywords.length === 0) return;
    const updated = insertAdditionalSkills(resumeTex, confirmedKeywords);
    setResumeTex(updated);
    setAnalysisResult((prev) =>
      prev
        ? {
            ...prev,
            matched: [...prev.matched, ...confirmedKeywords].sort((a, b) =>
              a.keyword.localeCompare(b.keyword)
            ),
            missing: prev.missing.filter(
              (k) => !confirmedKeywords.some((c) => c.keyword === k.keyword)
            ),
          }
        : prev
    );
    setConfirmedKeywords([]);
  }

  function handleApplyBulletRewrite(fullMatch: string, newContent: string) {
    setResumeTex((prev) => applyBulletRewrite(prev, fullMatch, newContent));
  }

  async function handleCompile() {
    setCompiling(true);
    setCompileError(null);
    try {
      const blob = await compileResume(resumeTex);
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : "Compilation failed.");
    } finally {
      setCompiling(false);
    }
  }

  if (loadingResume) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ATS Resume Matcher</h1>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>
      <main className="grid flex-1 grid-cols-1 divide-y divide-gray-200 overflow-y-auto dark:divide-gray-700 md:grid-cols-2 md:divide-x md:divide-y-0 md:overflow-hidden">
        <div className="h-[70vh] overflow-y-auto bg-white dark:bg-gray-800 md:h-auto">
          <JDPanel
            jdText={jdText}
            onJdChange={setJdText}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
            result={analysisResult}
            confirmedKeywords={confirmedKeywords}
            onToggleConfirmed={toggleConfirmed}
            onApplyConfirmed={applyConfirmed}
            error={analysisError}
            resumeTex={resumeTex}
            onApplyBulletRewrite={handleApplyBulletRewrite}
          />
        </div>
        <div className="h-[70vh] overflow-hidden bg-white dark:bg-gray-800 md:h-auto">
          <ResumePanel
            tex={resumeTex}
            onTexChange={setResumeTex}
            pdfUrl={pdfUrl}
            onCompile={handleCompile}
            compiling={compiling}
            compileError={compileError}
          />
        </div>
      </main>
    </div>
  );
}
