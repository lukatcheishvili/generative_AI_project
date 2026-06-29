"""
Provider seam — the Python port of web/lib/llm.ts.

Every node calls the model through ONE function: `call_model(prompt, temperature)`.
Swapping LLM_PROVIDER between "gemini" and "vertex" changes the model — never the graph.

  - "gemini" -> Gemini Developer API, authenticated with GEMINI_API_KEY.
  - "vertex" -> Vertex AI on Google Cloud, authenticated with a service account
                (or Application Default Credentials locally).

`creds` carries optional per-request overrides from the Settings panel so a user
can run on their OWN keys instead of the server's defaults.
"""

import base64
import json
import os
from typing import Optional, TypedDict

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


class Credentials(TypedDict, total=False):
    provider: str                    # "gemini" | "vertex"
    geminiApiKey: str
    vertexProject: str
    vertexLocation: str
    vertexServiceAccountJson: str


def active_provider() -> str:
    """The server default, from LLM_PROVIDER (defaults to gemini)."""
    return (
        "vertex"
        if os.environ.get("LLM_PROVIDER", "gemini").strip().lower() == "vertex"
        else "gemini"
    )


def call_model(
    prompt: str,
    temperature: float = 0.7,
    model: Optional[str] = None,
    creds: Optional[Credentials] = None,
) -> str:
    """Single entry point. Dispatches to Gemini or Vertex; returns text."""
    creds = creds or {}
    model_name = model or MODEL_NAME
    provider = creds.get("provider") or active_provider()
    if provider == "vertex":
        return _call_vertex(prompt, temperature, model_name, creds)
    return _call_gemini(prompt, temperature, model_name, creds)


# --------------------------------------------------------------------------- #
# Gemini Developer API                                                        #
# --------------------------------------------------------------------------- #
def _call_gemini(
    prompt: str, temperature: float, model_name: str, creds: Credentials
) -> str:
    import google.generativeai as genai

    api_key = (creds.get("geminiApiKey") or "").strip() or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "No Gemini API key. Add one in Settings, or set GEMINI_API_KEY in the environment."
        )
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    resp = model.generate_content(
        prompt, generation_config={"temperature": temperature}
    )
    return resp.text


# --------------------------------------------------------------------------- #
# Vertex AI                                                                   #
# --------------------------------------------------------------------------- #
def _call_vertex(
    prompt: str, temperature: float, model_name: str, creds: Credentials
) -> str:
    import vertexai
    from vertexai.generative_models import GenerativeModel

    project = (creds.get("vertexProject") or "").strip() or os.environ.get(
        "GOOGLE_CLOUD_PROJECT"
    )
    location = (
        (creds.get("vertexLocation") or "").strip()
        or os.environ.get("GOOGLE_CLOUD_LOCATION")
        or "us-central1"
    )
    if not project:
        raise RuntimeError(
            "No Vertex project. Add one in Settings, or set GOOGLE_CLOUD_PROJECT in the environment."
        )

    credentials = _service_account_credentials(creds.get("vertexServiceAccountJson"))
    # If credentials are None, the SDK falls back to Application Default
    # Credentials (e.g. `gcloud auth application-default login` locally).
    vertexai.init(project=project, location=location, credentials=credentials)

    model = GenerativeModel(model_name)
    resp = model.generate_content(
        prompt, generation_config={"temperature": temperature}
    )
    text = (resp.text or "").strip()
    if not text:
        raise RuntimeError("Vertex AI returned an empty response.")
    return text


def _service_account_credentials(override: Optional[str] = None):
    """
    Read service-account credentials for Vertex from GOOGLE_SERVICE_ACCOUNT_JSON
    (or a per-request override). Accepts either raw JSON or a base64 encoding of
    it (base64 is easier to paste into a hosting env var). Returns None to fall
    back to ADC.
    """
    raw = (override or "").strip() or (
        os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or ""
    ).strip()
    if not raw:
        return None

    # Tolerate a value that was pasted wrapped in quotes.
    if (raw.startswith('"') and raw.endswith('"')) or (
        raw.startswith("'") and raw.endswith("'")
    ):
        raw = raw[1:-1].strip()

    # Raw JSON starts with "{"; otherwise treat it as base64 and strip any
    # whitespace/newlines a dashboard may have inserted into the long string.
    if raw.startswith("{"):
        json_str = raw
    else:
        json_str = base64.b64decode("".join(raw.split())).decode("utf-8")

    try:
        info = json.loads(json_str)
    except ValueError as exc:
        raise RuntimeError(
            "GOOGLE_SERVICE_ACCOUNT_JSON is set but did not decode to valid JSON. "
            "Re-copy the full base64 string and paste it without truncation."
        ) from exc

    from google.oauth2 import service_account

    return service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
