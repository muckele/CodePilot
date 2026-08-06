from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Iterable

from .schemas import CoachRequest, CoachResponse

TOKEN_PATTERN = re.compile(r"[a-z0-9-]{2,}")


def _tokens(value: str) -> list[str]:
    return TOKEN_PATTERN.findall(value.lower())


def mock_embedding(value: str, dimensions: int = 64) -> list[float]:
    vector = [0.0] * dimensions
    for token in _tokens(value):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:2], "big") % dimensions
        vector[index] += 1.0 if digest[2] % 2 == 0 else -1.0
    norm = math.sqrt(sum(number * number for number in vector))
    return vector if norm == 0 else [number / norm for number in vector]


def lexical_score(query: str, candidate: str) -> float:
    query_tokens = set(_tokens(query))
    candidate_tokens = set(_tokens(candidate))
    if not query_tokens or not candidate_tokens:
        return 0.0
    return len(query_tokens & candidate_tokens) / len(query_tokens)


def mock_rerank(query: str, candidates: Iterable[tuple[str, str]]) -> list[tuple[str, float]]:
    scored = [(candidate_id, lexical_score(query, text)) for candidate_id, text in candidates]
    return sorted(scored, key=lambda item: (-item[1], item[0]))


class MockCoachProvider:
    provider_name = "python_mock"

    def coach(self, request: CoachRequest) -> CoachResponse:
        learner_context = (
            "Use the learner’s note as a question to inspect, not as proof of mastery."
            if request.learner_text.strip()
            else "No learner note was supplied, so keep the guidance at the mission boundary."
        )
        return CoachResponse(
            provider="python_mock",
            heading=f"Generated guidance for Day {request.day_number}",
            explanation=(
                f"{request.title} is useful when you can connect an action to observable evidence. "
                f"The governing principle is: {request.principle} {learner_context}"
            ),
            socratic_question=(
                "Which result would falsify your current explanation, "
                "and what would you inspect next?"
            ),
            next_tiny_step=(
                "Make one bounded change toward this artifact, then name the check: "
                f"{request.artifact}"
            ),
            evidence_boundary=(
                "This generated guidance does not claim understanding. Completion still requires "
                "learner-authored evidence and retrieval."
            ),
            safety_note=(
                "CodeLift guidance is educational, not mental-health, employment, "
                "or human-worth advice."
            ),
        )


class MockEmbeddingProvider:
    provider_name = "mock"

    def embed(self, texts: list[str], dimensions: int) -> list[list[float]]:
        return [mock_embedding(text, dimensions) for text in texts]


class MockReranker:
    provider_name = "mock"

    def rerank(
        self, query: str, candidates: list[tuple[str, str]], top_k: int
    ) -> list[tuple[str, float]]:
        return mock_rerank(query, candidates)[:top_k]


class MockLocalInferenceProvider:
    provider_name = "mock_local"

    def generate(self, prompt: str, model_id: str, max_new_tokens: int) -> str:
        del prompt, model_id, max_new_tokens
        return (
            "Mock-local generation: identify the next testable state transition, make one change, "
            "and preserve the learner’s own explain-back."
        )
