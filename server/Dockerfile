# Portable container image for the PageForge backend — works on Railway, Google
# Cloud Run, Fly.io, or Render's Docker runtime. (The recommended Render path uses
# the native-Python runtime via render.yaml and does NOT use this file.)
#
# Build context must be the server/ directory, e.g.:
#   docker build -t pageforge-backend ./server
#   docker run -p 8000:8000 --env-file web/.env.local pageforge-backend
# Cloud Run:  gcloud run deploy pageforge-backend --source server --region europe-west1

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Hosts inject $PORT (Cloud Run 8080, Railway dynamic, Render 10000); default 8000.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
