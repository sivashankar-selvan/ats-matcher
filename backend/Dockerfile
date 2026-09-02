FROM python:3.11-slim

# --- system deps ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    libgraphite2-3 libharfbuzz0b libfontconfig1 libssl3 libicu72 zlib1g \
    && rm -rf /var/lib/apt/lists/*

# --- Tectonic (self-contained LaTeX engine, no full TeX Live needed) ---
WORKDIR /tmp/tectonic-install
RUN curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && mv tectonic /usr/local/bin/tectonic \
    && chmod +x /usr/local/bin/tectonic
WORKDIR /

ENV TECTONIC_CACHE_DIR=/var/cache/tectonic
RUN mkdir -p /var/cache/tectonic && chmod 777 /var/cache/tectonic

# --- app ---
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Pre-warm the Tectonic cache at BUILD time using the actual default resume,
# not a generic placeholder — this bakes the exact font/package bundle this
# resume needs (FiraSans, FontAwesome, etc.) into the image layer itself.
# That matters specifically on free hosting tiers (e.g. Render's free web
# service) which have no persistent disk: the container's writable
# filesystem resets on every spin-down/cold-start, but image layers don't,
# so this avoids a slow re-download on the first request after every wake.
RUN tectonic data/default_resume.tex -o /tmp && rm -f /tmp/default_resume.pdf

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
