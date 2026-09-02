/**
 * Finds every bullet in the resume's Experience section automatically, so
 * the user never has to copy/paste bullets one at a time. Template-specific:
 * this resume template wraps each bullet as \resumeItem{...}, and since the
 * content can itself contain braces (e.g. \textbf{...}), a plain regex can't
 * find the matching close brace -- this does real brace counting instead.
 */

export interface ExperienceBullet {
  id: string;
  original: string; // raw LaTeX inside \resumeItem{...}, e.g. "Built a \textbf{full-stack}..."
  fullMatch: string; // the full "\resumeItem{...}" text, used for an exact replace
  preview: string; // original with LaTeX markup stripped, for display
}

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function stripLatexFormatting(s: string): string {
  return s
    .replace(/\\textbf\{([^{}]*)\}/g, "$1")
    .replace(/\\emph\{([^{}]*)\}/g, "$1")
    .replace(/\\textit\{([^{}]*)\}/g, "$1")
    .replace(/\\href\{[^{}]*\}\{([^{}]*)\}/g, "$1")
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&")
    .replace(/\\vspace\{[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractExperienceBullets(tex: string): ExperienceBullet[] {
  const sectionMatch = tex.match(/\\section\{Experience\}/i);
  if (!sectionMatch || sectionMatch.index === undefined) return [];

  const sectionStart = sectionMatch.index;
  const afterHeading = sectionStart + sectionMatch[0].length;
  const nextSectionIdx = tex.indexOf("\\section{", afterHeading);
  const sectionEnd = nextSectionIdx === -1 ? tex.length : nextSectionIdx;
  const sectionText = tex.slice(sectionStart, sectionEnd);

  const marker = "\\resumeItem{";
  const bullets: ExperienceBullet[] = [];
  let searchFrom = 0;

  while (true) {
    const idx = sectionText.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const openBrace = idx + marker.length - 1;
    const closeBrace = findMatchingBrace(sectionText, openBrace);
    if (closeBrace === -1) break;

    const content = sectionText.slice(openBrace + 1, closeBrace).trim();
    const fullMatch = sectionText.slice(idx, closeBrace + 1);
    bullets.push({
      id: `bullet-${bullets.length}`,
      original: content,
      fullMatch,
      preview: stripLatexFormatting(content),
    });
    searchFrom = closeBrace + 1;
  }

  return bullets;
}

/** Replaces one specific bullet's full "\resumeItem{...}" text with a new one. */
export function applyBulletRewrite(tex: string, fullMatch: string, newContent: string): string {
  const newFullMatch = `\\resumeItem{${newContent}}`;
  return tex.replace(fullMatch, newFullMatch);
}
