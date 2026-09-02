"""
Deterministic, dependency-free keyword matching between a job description
and a resume. No LLM call is on this path on purpose: it's the core scoring
logic, and it should be free, instant, and not depend on any external API
being up or within its rate limit.

Design:
  1. Scan the JD for every known skill (from skills_dictionary.SKILLS) using
     word-boundary, case-insensitive matching against the canonical term and
     all of its aliases.
  2. Weight a keyword higher if it shows up in the first third of the JD
     (titles / "must have" sections tend to front-load the important terms)
     or if it's repeated multiple times.
  3. Scan the resume the same way and diff the two keyword sets.
"""

import re
from dataclasses import dataclass, field
from skills_dictionary import SKILLS

# Build a flat lookup: alias -> canonical name, longest alias first so
# multi-word aliases (e.g. "spring boot") match before shorter ones ("boot").
_ALIAS_TO_CANONICAL: list[tuple[str, str]] = []
for canonical, info in SKILLS.items():
    for alias in set([canonical.lower(), *[a.lower() for a in info["aliases"]]]):
        _ALIAS_TO_CANONICAL.append((alias, canonical))
_ALIAS_TO_CANONICAL.sort(key=lambda pair: len(pair[0]), reverse=True)


def category_of(keyword: str) -> str:
    """Category label for a canonical keyword, e.g. 'Kubernetes' -> 'Cloud & DevOps'."""
    info = SKILLS.get(keyword)
    return info["category"] if info else "Other"


def _find_keywords(text: str) -> dict[str, int]:
    """Return {canonical_keyword: occurrence_count} found in text."""
    counts: dict[str, int] = {}
    lowered = text.lower()
    for alias, canonical in _ALIAS_TO_CANONICAL:
        # Word-boundary match; escape regex-special chars in the alias
        # (things like "c++", "c#" need this).
        pattern = r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])"
        matches = re.findall(pattern, lowered)
        if matches:
            counts[canonical] = counts.get(canonical, 0) + len(matches)
    return counts


@dataclass
class MatchResult:
    score: float                       # 0-100
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    weighted_total: float = 0.0
    weighted_matched: float = 0.0


def analyze(jd_text: str, resume_text: str) -> MatchResult:
    jd_counts = _find_keywords(jd_text)
    if not jd_counts:
        return MatchResult(score=0.0)

    resume_counts = _find_keywords(resume_text)

    # Weight: keywords that appear in the first third of the JD count double
    # (rough proxy for "this is emphasized / a must-have", since JDs
    # typically state core requirements before nice-to-haves).
    first_third_cutoff = len(jd_text) // 3
    first_third_text = jd_text[:first_third_cutoff].lower()

    weighted_total = 0.0
    weighted_matched = 0.0
    matched: list[str] = []
    missing: list[str] = []

    for keyword, count in jd_counts.items():
        weight = 1.0
        alias_hits = [a for a, c in _ALIAS_TO_CANONICAL if c == keyword]
        if any(a in first_third_text for a in alias_hits):
            weight = 2.0
        weight += min(count - 1, 2) * 0.25  # small bonus for repetition, capped

        weighted_total += weight
        if keyword in resume_counts:
            matched.append(keyword)
            weighted_matched += weight
        else:
            missing.append(keyword)

    score = round((weighted_matched / weighted_total) * 100, 1) if weighted_total else 0.0

    # Sort missing by weight (most important gaps first) for a nicer UI.
    def _weight_of(keyword: str) -> float:
        alias_hits = [a for a, c in _ALIAS_TO_CANONICAL if c == keyword]
        w = 2.0 if any(a in first_third_text for a in alias_hits) else 1.0
        return w

    missing.sort(key=_weight_of, reverse=True)
    matched.sort()

    return MatchResult(
        score=score,
        matched=matched,
        missing=missing,
        weighted_total=weighted_total,
        weighted_matched=weighted_matched,
    )
