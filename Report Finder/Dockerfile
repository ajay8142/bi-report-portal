# Report Finder/Dockerfile
# Semantic report search microservice (Flask + ChromaDB + HuggingFace
# embeddings). Ships the prebuilt chroma_store/ index — no ingestion runs
# inside the container; rebuild it locally with build_report_vectorstore.py
# and rebuild the image when reports.xlsx changes.

FROM python:3.11-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY search_api.py ./
COPY chroma_store ./chroma_store

# HuggingFace downloads the ~1.3GB embedding model into this cache dir on
# first run — mount it as a volume (see docker-compose.yml) so a container
# restart/recreate doesn't re-download it every time.
RUN mkdir -p /app/.cache
ENV HF_HOME=/app/.cache/huggingface

# Non-root runtime user.
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Long start_period: the HuggingFace embedding model loads on first request
# to get_embeddings()/get_collection(), which the __main__ block warms up
# before serving — can take up to ~2 minutes on CPU.
HEALTHCHECK --interval=30s --timeout=10s --start-period=150s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "search_api.py"]
