/**
 * Inserts user-CONFIRMED keywords into the resume's skills section. This is
 * intentionally the only place this app ever edits resume content, and it
 * only ever touches the Skills section -- never "Experience" -- and only
 * after the person has explicitly clicked "I have this" for that specific
 * keyword. See JDPanel.tsx.
 *
 * Each keyword carries a `category` (e.g. "Cloud & DevOps") from the
 * backend's skills dictionary. Rather than dumping every confirmed keyword
 * into one generic bucket line, this tries to find the resume's own
 * existing line for that category (e.g. "Cloud & DevOps: AWS, Docker") and
 * appends there. Only keywords whose category has no matching line in the
 * resume fall back to a generic "Additional Keywords" line.
 *
 * The base `tex` passed in is never mutated in app state; this is called
 * fresh each time so toggling a keyword off and re-applying stays clean.
 */

interface ConfirmedKeyword {
  keyword: string;
  category: string;
}

// Bridges a keyword's canonical category (from backend/skills_dictionary.py)
// to however a real resume happens to word that section header, e.g. a
// "Databases" keyword should still find a resume's "DB" line.
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  "Languages": ["languages", "language", "programminglanguages"],
  "Frameworks": ["frameworks", "framework"],
  "Backend": ["backend", "backdevelopment"],
  "Cloud & DevOps": ["clouddevops", "cloud", "devops"],
  "Databases": ["databases", "database", "db"],
  "Tools": ["tools", "platformstools", "platforms", "tooling"],
  "Concepts": ["concepts", "concept", "coreconcepts"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function categoryMatches(category: string, label: string): boolean {
  const normLabel = normalize(label);
  const synonyms = CATEGORY_SYNONYMS[category] ?? [normalize(category)];
  return synonyms.some(
    (syn) => normLabel === syn || normLabel.includes(syn) || syn.includes(normLabel)
  );
}

export function insertAdditionalSkills(tex: string, items: ConfirmedKeyword[]): string {
  if (items.length === 0) return tex;

  const byCategory = new Map<string, string[]>();
  for (const { keyword, category } of items) {
    const list = byCategory.get(category) ?? [];
    list.push(keyword);
    byCategory.set(category, list);
  }

  const sectionRegex = /\\section\{(Technical Skills|Skills)\}([\s\S]*?)\\resumeSubHeadingListEnd/i;
  const sectionMatch = tex.match(sectionRegex);

  if (!sectionMatch) {
    // No recognizable skills section at all -- add a standalone one for
    // everything, rather than trying to be clever about placement.
    const allKeywords = items.map((i) => i.keyword);
    const line = `    \\resumeItem{\\textbf{Additional Keywords (self-confirmed)}{: ${allKeywords.join(", ")}}}`;
    const newSection = `\\section{Additional Keywords}\n\\begin{itemize}[leftmargin=0.15in]\n${line}\n\\end{itemize}\n`;
    return tex.includes("\\end{document}")
      ? tex.replace("\\end{document}", `${newSection}\\end{document}`)
      : `${tex}\n${newSection}`;
  }

  let sectionText = sectionMatch[0];
  const labelLineRegex = /(\\textbf\{([^}]*)\}\{:\s*)([^}]*)(\})/g;
  const unmatchedCategories: string[] = [];

  for (const [category, keywords] of byCategory.entries()) {
    let matchedLabel = false;

    sectionText = sectionText.replace(
      labelLineRegex,
      (full: string, prefix: string, label: string, itemsStr: string, closeBrace: string) => {
        if (matchedLabel || !categoryMatches(category, label)) return full;
        matchedLabel = true;
        const existing = itemsStr.split(",").map((s) => s.trim().toLowerCase());
        const toAdd = keywords.filter((k) => !existing.includes(k.toLowerCase()));
        if (toAdd.length === 0) return full;
        return `${prefix}${itemsStr.trim()}, ${toAdd.join(", ")}${closeBrace}`;
      }
    );

    if (!matchedLabel) unmatchedCategories.push(category);
  }

  if (unmatchedCategories.length > 0) {
    const leftoverKeywords = unmatchedCategories.flatMap((c) => byCategory.get(c) ?? []);
    const line = `    \\resumeItem{\\textbf{Additional Keywords (self-confirmed)}{: ${leftoverKeywords.join(", ")}}}`;
    sectionText = sectionText.replace(
      "\\resumeSubHeadingListEnd",
      `${line}\n\\resumeSubHeadingListEnd`
    );
  }

  return tex.replace(sectionMatch[0], sectionText);
}
