# Backend-only preparation. Build context must be the repository root.
FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1
WORKDIR /app
RUN python -m pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu
COPY deploy/backend/requirements.txt /app/deploy/backend/requirements.txt
RUN python -m pip install -r deploy/backend/requirements.txt
RUN useradd --create-home --uid 1000 pestprint
COPY --chown=pestprint:pestprint app.py inference.py /app/
COPY --chown=pestprint:pestprint deploy/backend /app/deploy/backend/
RUN mkdir -p /app/model && chown pestprint:pestprint /app/model
USER pestprint
EXPOSE 8080
CMD ["gunicorn", "--config", "deploy/backend/gunicorn.conf.py", "deploy.backend.wsgi:app"]
