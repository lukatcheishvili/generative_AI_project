"""Provider seam.

Every node calls the model through one function: `call_model(prompt, temperature)`.
Swapping LLM_PROVIDER between "gemini" and "vertex" changes the model — never the
graph. A 1:1 port of web/lib/llm.ts.

  - "gemini" -> Gemini Developer API, authenticated with GEMINI_API_KEY.
  - "vertex" -> Vertex AI on Google Cloud, authenticated with a service account
                (or Application Default Credentials locally).
"""

from __future__ import annotations

import base64
import binascii
import json
import os
import re
from typing import Optional

from .types import Credentials


def _model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def active_provider() -> str:
    """The server default provider from LLM_PROVIDER ("gemini" unless "vertex")."""
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
    """Route a single prompt to the active provider and return its text."""
    model_name = model or _model_name()
    provider = (creds.provider if creds and creds.provider else None) or active_provider()
    if provider == "vertex":
        return _call_vertex(prompt, temperature, model_name, creds)
    return _call_gemini(prompt, temperature, model_name, creds)


# --------------------------------------------------------------------------- #
# Gemini Developer API                                                        #
# --------------------------------------------------------------------------- #
def _call_gemini(
    prompt: str,
    temperature: float,
    model_name: str,
    creds: Optional[Credentials],
) -> str:
    import google.generativeai as genai

    api_key = (creds.geminiApiKey.strip() if creds and creds.geminiApiKey else "") or os.environ.get(
        "GEMINI_API_KEY"
    )
    if not api_key:
        raise RuntimeError(
            "No Gemini API key. Add one in Settings, or configure GEMINI_API_KEY on the server."
        )

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name,
        generation_config={"temperature": temperature},
    )
    result = model.generate_content(prompt)
    return result.text


# --------------------------------------------------------------------------- #
# Vertex AI                                                                   #
# --------------------------------------------------------------------------- #
def _call_vertex(
    prompt: str,
    temperature: float,
    model_name: str,
    creds: Optional[Credentials],
) -> str:
    import vertexai
    from vertexai.generative_models import GenerativeModel

    project = (creds.vertexProject.strip() if creds and creds.vertexProject else "") or os.environ.get(
        "GOOGLE_CLOUD_PROJECT"
    )
    location = (
        (creds.vertexLocation.strip() if creds and creds.vertexLocation else "")
        or os.environ.get("GOOGLE_CLOUD_LOCATION")
        or "us-central1"
    )
    if not project:
        raise RuntimeError(
            "No Vertex project. Add one in Settings, or configure GOOGLE_CLOUD_PROJECT on the server."
        )

    credentials = _service_account_credentials(
        creds.vertexServiceAccountJson if creds else None
    )
    # If credentials are omitted, the SDK falls back to Application Default
    # Credentials (e.g. `gcloud auth application-default login` locally).
    vertexai.init(project=project, location=location, credentials=credentials)

    model = GenerativeModel(model_name)
    result = model.generate_content(
        prompt,
        generation_config={"temperature": temperature},
    )
    parts = []
    try:
        parts = result.candidates[0].content.parts
    except (IndexError, AttributeError):
        parts = []
    text = "".join(p.text for p in parts if getattr(p, "text", None))
    if not text:
        raise RuntimeError("Vertex AI returned an empty response.")
    return text


def _service_account_credentials(override: Optional[str]):
    """Read service-account credentials for Vertex from GOOGLE_SERVICE_ACCOUNT_JSON.

    Accepts either raw JSON or a base64 encoding of it (base64 is easier to paste
    into an env var on a host like Vercel). Returns None to fall back to ADC.
    """
    raw = (override.strip() if override else "") or (
        os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    )
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
        try:
            json_str = base64.b64decode(re.sub(r"\s+", "", raw)).decode("utf-8")
        except (binascii.Error, ValueError) as exc:
            raise RuntimeError(
                "GOOGLE_SERVICE_ACCOUNT_JSON is set but did not decode from base64. "
                "Re-copy the full base64 string and paste it without truncation."
            ) from exc

    try:
        info = json.loads(json_str)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "GOOGLE_SERVICE_ACCOUNT_JSON is set but did not decode to valid JSON. "
            "Re-copy the full base64 string and paste it without truncation."
        ) from exc

    from google.oauth2 import service_account

    return service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
