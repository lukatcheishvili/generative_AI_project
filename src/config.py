import os
from dotenv import load_dotenv

load_dotenv()

def get_llm():
    """
    Returns a LangChain BaseChatModel based on the LLM_PROVIDER environment variable.
    Default is ChatOpenAI (gpt-4o-mini).
    """
    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620"),
            temperature=0,
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
    elif provider == "google" or provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        # The user's API key is for the latest 2026 models. 
        # gemini-1.5 models are deprecated/removed.
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
        if "1.5" in model_name:
            model_name = "gemini-3.1-pro-preview"
            
        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0,
            google_api_key=os.getenv("GEMINI_API_KEY")
        )
    else:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0,
            api_key=os.getenv("OPENAI_API_KEY")
        )
