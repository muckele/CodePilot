from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HealthResponse(StrictModel):
    status: Literal["ok"]
    service: Literal["codelift-ai"]
    provider: Literal["mock"]
    model_download_required: Literal[False]


class ProgressEvent(StrictModel):
    day_number: int = Field(ge=1, le=365)
    mode: Literal["core", "recovery"]
    completed_date: date
    actual_minutes: int = Field(ge=0, le=240)


class ProgressAnalysisRequest(StrictModel):
    events: list[ProgressEvent] = Field(max_length=365)
    today: date


class ProgressAnalysisResponse(StrictModel):
    total_returns: int = Field(ge=0)
    core_completions: int = Field(ge=0)
    recovery_wins: int = Field(ge=0)
    rolling_7_day_returns: int = Field(ge=0, le=7)
    rolling_30_day_returns: int = Field(ge=0, le=30)
    average_minutes: float = Field(ge=0)
    interpretation: str


class RiskAssistRequest(StrictModel):
    rolling_7_day_returns: int = Field(ge=0, le=7)
    open_review_count: int = Field(ge=0, le=1000)
    average_minutes: float = Field(ge=0, le=240)


class RiskAssistResponse(StrictModel):
    support_score: float = Field(ge=0, le=1)
    band: Literal["steady", "offer_recovery", "offer_planning"]
    guidance: str
    human_decision_required: Literal[True]
    model_card: Literal["deterministic-baseline-v1"]


class EmbeddingRequest(StrictModel):
    texts: list[Annotated[str, Field(min_length=1, max_length=8_000)]] = Field(
        min_length=1, max_length=64
    )
    dimensions: int = Field(default=64, ge=8, le=512)


class EmbeddingResponse(StrictModel):
    provider: Literal["mock"]
    dimensions: int
    vectors: list[list[float]]


class RerankCandidate(StrictModel):
    candidate_id: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=8_000)


class RerankRequest(StrictModel):
    query: str = Field(min_length=1, max_length=1_000)
    candidates: list[RerankCandidate] = Field(min_length=1, max_length=100)
    top_k: int = Field(default=5, ge=1, le=20)


class RerankResult(StrictModel):
    candidate_id: str
    score: float = Field(ge=0, le=1)


class RerankResponse(StrictModel):
    provider: Literal["mock"]
    results: list[RerankResult]


class CoachRequest(StrictModel):
    action: Literal[
        "explain", "socratic", "reflect", "next_step", "weekly_recap", "portfolio_story"
    ]
    day_number: int = Field(ge=1, le=365)
    title: str = Field(min_length=1, max_length=200)
    principle: str = Field(min_length=1, max_length=2_000)
    artifact: str = Field(min_length=1, max_length=2_000)
    learner_text: str = Field(max_length=4_000)


class CoachResponse(StrictModel):
    provider: Literal["python_mock"]
    heading: str
    explanation: str
    socratic_question: str
    next_tiny_step: str
    evidence_boundary: str
    safety_note: str


class LocalGenerateRequest(StrictModel):
    prompt: str = Field(min_length=1, max_length=4_000)
    model_id: str = Field(default="mock-local", min_length=1, max_length=200)
    max_new_tokens: int = Field(default=128, ge=1, le=512)


class LocalGenerateResponse(StrictModel):
    provider: Literal["mock_local"]
    model_id: str
    generated_text: str
    downloaded_model: Literal[False]


class PeftLabRequest(StrictModel):
    examples: int = Field(ge=8, le=10_000)
    rank: int = Field(default=8, ge=1, le=128)
    baseline_score: float = Field(ge=0, le=1)
    adapter_score: float = Field(ge=0, le=1)


class PeftLabResponse(StrictModel):
    recommendation: Literal["prefer_prompt_or_retrieval", "bounded_adapter_experiment_justified"]
    score_delta: float
    trainable_parameter_fraction_estimate: float = Field(ge=0, le=1)
    executed_training: Literal[False]
    rationale: str
