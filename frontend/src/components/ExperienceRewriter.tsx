import { useMemo, useState } from "react";
import { rewriteBullet } from "../api";
import { ExperienceBullet, extractExperienceBullets, stripLatexFormatting } from "../bulletParser";

interface Props {
  resumeTex: string;
  keywords: string[]; // JD keywords (matched + missing) to weave in where truthful
  onApply: (fullMatch: string, newContent: string) => void;
}

interface Suggestion {
  rewritten: string | null;
  loading: boolean;
  error: string | null;
  applied: boolean;
  // Snapshot of the bullet's content from just before "Apply" was clicked,
  // so "Revert" can put it back even though the bullet's current fullMatch
  // (post-apply) is now the rewritten text, not the original.
  preApplyContent: string | null;
}

export default function ExperienceRewriter({ resumeTex, keywords, onApply }: Props) {
  // Re-scanned each time resumeTex changes (including after an apply/revert),
  // so fullMatch always reflects what's currently in the resume.
  const bullets = useMemo(() => extractExperienceBullets(resumeTex), [resumeTex]);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [running, setRunning] = useState(false);

  async function rewordAll() {
    setRunning(true);
    const initial: Record<string, Suggestion> = {};
    bullets.forEach((b) => {
      initial[b.id] = { rewritten: null, loading: true, error: null, applied: false, preApplyContent: null };
    });
    setSuggestions(initial);

    await Promise.all(
      bullets.map(async (b) => {
        try {
          const rewritten = await rewriteBullet(b.original, keywords);
          setSuggestions((prev) => ({ ...prev, [b.id]: { ...prev[b.id], rewritten, loading: false } }));
        } catch (err) {
          setSuggestions((prev) => ({
            ...prev,
            [b.id]: {
              ...prev[b.id],
              loading: false,
              error: err instanceof Error ? err.message : "Rewrite failed.",
            },
          }));
        }
      })
    );
    setRunning(false);
  }

  function apply(b: ExperienceBullet) {
    const s = suggestions[b.id];
    if (!s?.rewritten) return;
    onApply(b.fullMatch, s.rewritten);
    setSuggestions((prev) => ({
      ...prev,
      [b.id]: { ...prev[b.id], applied: true, preApplyContent: b.original },
    }));
  }

  function revert(b: ExperienceBullet) {
    // `b` here is the CURRENT (post-apply) bullet, so b.fullMatch is the
    // rewritten "\resumeItem{...}" block presently sitting in the resume.
    const s = suggestions[b.id];
    if (!s?.applied || s.preApplyContent === null) return;
    onApply(b.fullMatch, s.preApplyContent);
    setSuggestions((prev) => ({ ...prev, [b.id]: { ...prev[b.id], applied: false } }));
  }

  const results = Object.entries(suggestions);
  const configIssue = results.find(([, s]) => s.error?.toLowerCase().includes("not configured"));

  return (
    <div className="flex flex-col gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
      <div>
        <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
          Reword Experience bullets (Gemini, optional)
        </h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Finds every bullet in your Experience section on its own -- no
          copy-pasting needed -- and rewords each one to use the JD's
          terminology where it's already true. Nothing invented, and nothing
          changes in your resume until you click "Apply" on a specific one --
          and you can "Revert" any single one back afterward.
        </p>
      </div>

      <button
        onClick={rewordAll}
        disabled={running || bullets.length === 0}
        className="self-start rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {running ? "Rewording..." : `Reword all ${bullets.length || ""} bullets with Gemini`}
      </button>

      {bullets.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Couldn't find an Experience section with recognizable bullets to reword.
        </p>
      )}

      {configIssue && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {configIssue[1].error} — add{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">GEMINI_API_KEY</code> to{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">backend/.env</code> and restart
          the backend.
        </p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-3">
          {bullets.map((b) => {
            const s = suggestions[b.id];
            if (!s) return null;
            return (
              <div key={b.id} className="rounded-md border border-gray-200 p-2 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{b.preview}</p>
                {s.loading && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Rewording...</p>
                )}
                {s.error && !s.error.toLowerCase().includes("not configured") && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{s.error}</p>
                )}
                {s.rewritten && !s.applied && (
                  <div className="mt-1 rounded bg-indigo-50 p-2 dark:bg-indigo-950/30">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {stripLatexFormatting(s.rewritten)}
                    </p>
                    <button
                      onClick={() => apply(b)}
                      className="mt-1 rounded bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Apply to resume
                    </button>
                  </div>
                )}
                {s.applied && (
                  <div className="mt-1 rounded bg-green-50 p-2 dark:bg-green-950/30">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{b.preview}</p>
                    <button
                      onClick={() => revert(b)}
                      className="mt-1 rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-700"
                    >
                      Applied ✓ — Revert
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
