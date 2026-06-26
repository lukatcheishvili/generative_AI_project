import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("No API Key")
    exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
r = requests.get(url)
if r.status_code == 200:
    data = r.json()
    for m in data.get("models", []):
        print(m.get("name"))
else:
    print(r.status_code, r.text)
