"""
Compiles a LaTeX source string to PDF bytes using the Tectonic engine.

Tectonic is a single self-contained binary (no full TeX Live install), which
makes it practical to run inside a small Docker container on a free hosting
tier. See backend/Dockerfile for how it's installed and pre-warmed.
"""

import subprocess
import tempfile
from pathlib import Path


class LatexCompileError(Exception):
    def __init__(self, message: str, log: str = ""):
        super().__init__(message)
        self.log = log


def compile_tex_to_pdf(tex_source: str, timeout_seconds: int = 120) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        tex_path = tmp_path / "resume.tex"
        pdf_path = tmp_path / "resume.pdf"
        tex_path.write_text(tex_source, encoding="utf-8")

        try:
            result = subprocess.run(
                ["tectonic", str(tex_path), "-o", str(tmp_path)],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                cwd=tmp_path,
            )
        except FileNotFoundError as exc:
            raise LatexCompileError(
                "tectonic binary not found on PATH. Install it (see backend/Dockerfile) "
                "or, for local dev, follow https://tectonic-typesetting.github.io/book/latest/installation/"
            ) from exc
        except subprocess.TimeoutExpired as exc:
            raise LatexCompileError("LaTeX compilation timed out.") from exc

        if result.returncode != 0 or not pdf_path.exists():
            raise LatexCompileError(
                "LaTeX compilation failed.",
                log=(result.stdout or "") + "\n" + (result.stderr or ""),
            )

        return pdf_path.read_bytes()
