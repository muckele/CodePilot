from typing import Protocol

from .schemas import CoachRequest, CoachResponse


class CoachProvider(Protocol):
    provider_name: str

    def coach(self, request: CoachRequest) -> CoachResponse: ...


class EmbeddingProvider(Protocol):
    provider_name: str

    def embed(self, texts: list[str], dimensions: int) -> list[list[float]]: ...


class RerankerProvider(Protocol):
    provider_name: str

    def rerank(
        self, query: str, candidates: list[tuple[str, str]], top_k: int
    ) -> list[tuple[str, float]]: ...


class LocalInferenceProvider(Protocol):
    provider_name: str

    def generate(self, prompt: str, model_id: str, max_new_tokens: int) -> str: ...
