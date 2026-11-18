"""Optional Ollama adapter. NEXORA never downloads models and never requires this to be running."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlparse

import httpx

LOOPBACK = {"127.0.0.1", "localhost", "::1"}


class ModelProvider(Protocol):
    """Provider-independent interface; Ollama is the first implementation, llama.cpp can follow."""

    def status(self) -> dict[str, Any]: ...
    def chat(self, model: str, messages: list[dict[str, str]]) -> str: ...


class ProviderUnavailable(RuntimeError):
    pass


@dataclass
class OllamaProvider:
    base_url: str = "http://127.0.0.1:11434"
    status_timeout: float = 1.5
    chat_timeout: float = 180.0

    def __post_init__(self) -> None:
        host = urlparse(self.base_url).hostname or ""
        if host not in LOOPBACK:
            raise ValueError("Ollama URL must point at this machine (loopback) - student data never leaves the device")

    def status(self) -> dict[str, Any]:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=self.status_timeout)
            r.raise_for_status()
            models = [{"name": m.get("name"), "size_bytes": m.get("size"),
                       "parameter_size": (m.get("details") or {}).get("parameter_size"),
                       "quantization": (m.get("details") or {}).get("quantization_level")}
                      for m in r.json().get("models", [])]
            return {"provider": "ollama", "available": True, "url": self.base_url, "models": models}
        except (httpx.HTTPError, ValueError):
            return {"provider": "ollama", "available": False, "url": self.base_url, "models": [],
                    "help": "Install Ollama from ollama.com and pull a model yourself, e.g. `ollama pull llama3.2`. "
                            "NEXORA works fully without it."}

    def chat(self, model: str, messages: list[dict[str, str]]) -> str:
        try:
            r = httpx.post(f"{self.base_url}/api/chat", timeout=self.chat_timeout,
                           json={"model": model, "messages": messages, "stream": False,
                                 "options": {"temperature": 0.3}})
            r.raise_for_status()
            return r.json()["message"]["content"]
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise ProviderUnavailable(str(exc)) from exc
