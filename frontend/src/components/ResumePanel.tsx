import { useState } from "react";

interface Props {
  tex: string;
  onTexChange: (value: string) => void;
  pdfUrl: string | null;
  onCompile: () => void;
  compiling: boolean;
  compileError: string | null;
}

type Tab = "source" | "pdf";

export default function ResumePanel({
  tex,
  onTexChange,
  pdfUrl,
  onCompile,
  compiling,
  compileError,
}: Props) {
  const [tab, setTab] = useState<Tab>("pdf");

  function downloadTex() {
    const blob = new Blob([tex], { type: "text/x-tex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.tex";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <div className="flex gap-1 rounded-md bg-gray-100 p-1 dark:bg-gray-900">
          <button
            onClick={() => setTab("source")}
            className={`rounded px-3 py-1 text-sm font-medium ${
              tab === "source"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            Source
          </button>
          <button
            onClick={() => setTab("pdf")}
            className={`rounded px-3 py-1 text-sm font-medium ${
              tab === "pdf"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            PDF
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={downloadTex}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Download .tex
          </button>
          <button
            onClick={onCompile}
            disabled={compiling}
            className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            {compiling ? "Compiling..." : "Recompile PDF"}
          </button>
        </div>
      </div>

      {compileError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {compileError}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {tab === "source" ? (
          <textarea
            className="h-full w-full resize-none border-0 bg-white p-4 font-mono text-xs text-gray-900 focus:outline-none dark:bg-gray-900 dark:text-gray-100"
            value={tex}
            onChange={(e) => onTexChange(e.target.value)}
            spellCheck={false}
          />
        ) : pdfUrl ? (
          <object data={pdfUrl} type="application/pdf" className="h-full w-full">
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
              PDF preview isn't supported here — use "Download .tex" and compile
              locally, or switch to the Source tab.
            </p>
          </object>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            Click "Recompile PDF" to render a preview.
          </div>
        )}
      </div>
    </div>
  );
}
