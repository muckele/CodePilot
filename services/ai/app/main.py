from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import FastAPI

from .analytics import DeterministicSupportBaseline, profile_progress
from .protocols import (
    CoachProvider,
    EmbeddingProvider,
    LocalInferenceProvider,
    RerankerProvider,
)
from .providers import (
    MockCoachProvider,
    MockEmbeddingProvider,
    MockLocalInferenceProvider,
    MockReranker,
)
from .schemas import (
    CoachRequest,
    CoachResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    HealthResponse,
    LocalGenerateRequest,
    LocalGenerateResponse,
    PeftLabRequest,
    PeftLabResponse,
    ProgressAnalysisRequest,
    ProgressAnalysisResponse,
    RerankRequest,
    RerankResponse,
    RerankResult,
    RiskAssistRequest,
    RiskAssistResponse,
)

app = FastAPI(
    title="CodeLift AI internal service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
)
coach_provider: CoachProvider = MockCoachProvider()
embedding_provider: EmbeddingProvider = MockEmbeddingProvider()
reranker_provider: RerankerProvider = MockReranker()
local_provider: LocalInferenceProvider = MockLocalInferenceProvider()
support_baseline = DeterministicSupportBaseline()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="codelift-ai",
        provider="mock",
        model_download_required=False,
    )


@app.post("/v1/analyze/progress", response_model=ProgressAnalysisResponse)
def analyze_progress(request: ProgressAnalysisRequest) -> ProgressAnalysisResponse:
    today = date.fromisoformat(request.today)
    unique_dates = {date.fromisoformat(event.completed_date) for event in request.events}
    rolling_7 = sum(1 for completed in unique_dates if 0 <= (today - completed).days < 7)
    rolling_30 = sum(1 for completed in unique_dates if 0 <= (today - completed).days < 30)
    profile = profile_progress(request.events)
    return ProgressAnalysisResponse(
        total_returns=profile.total_returns,
        core_completions=profile.core_completions,
        recovery_wins=profile.recovery_wins,
        rolling_7_day_returns=rolling_7,
        rolling_30_day_returns=rolling_30,
        average_minutes=profile.average_minutes,
        interpretation=(
            "Returns are reported separately from Core and Recovery. "
            "No completion or mastery is inferred."
        ),
    )


@app.post("/v1/ml/risk-assist", response_model=RiskAssistResponse)
def risk_assist(request: RiskAssistRequest) -> RiskAssistResponse:
    score = support_baseline.support_score(
        request.rolling_7_day_returns,
        request.open_review_count,
        request.average_minutes,
    )
    band: Literal["steady", "offer_recovery", "offer_planning"]
    if score >= 0.65:
        band = "steady"
        guidance = "Keep the next mission small and evidence-backed."
    elif score >= 0.4:
        band = "offer_recovery"
        guidance = "Offer Recovery without converting it into a Core completion."
    else:
        band = "offer_planning"
        guidance = "Offer a humane one-Core-per-day catch-up plan for learner approval."
    return RiskAssistResponse(
        support_score=round(score, 4),
        band=band,
        guidance=guidance,
        human_decision_required=True,
        model_card="deterministic-baseline-v1",
    )


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
def embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    return EmbeddingResponse(
        provider="mock",
        dimensions=request.dimensions,
        vectors=embedding_provider.embed(request.texts, request.dimensions),
    )


@app.post("/v1/rerank", response_model=RerankResponse)
def rerank(request: RerankRequest) -> RerankResponse:
    ranked = reranker_provider.rerank(
        request.query,
        [(candidate.candidate_id, candidate.text) for candidate in request.candidates],
        request.top_k,
    )
    return RerankResponse(
        provider="mock",
        results=[
            RerankResult(candidate_id=candidate_id, score=score) for candidate_id, score in ranked
        ],
    )


@app.post("/v1/coach", response_model=CoachResponse)
def coach(request: CoachRequest) -> CoachResponse:
    return coach_provider.coach(request)


@app.post("/v1/local/generate", response_model=LocalGenerateResponse)
def local_generate(request: LocalGenerateRequest) -> LocalGenerateResponse:
    return LocalGenerateResponse(
        provider="mock_local",
        model_id=request.model_id,
        generated_text=local_provider.generate(
            request.prompt, request.model_id, request.max_new_tokens
        ),
        downloaded_model=False,
    )


@app.post("/v1/labs/peft", response_model=PeftLabResponse)
def peft_lab(request: PeftLabRequest) -> PeftLabResponse:
    delta = round(request.adapter_score - request.baseline_score, 4)
    justified = request.examples >= 100 and delta >= 0.05
    return PeftLabResponse(
        recommendation=(
            "bounded_adapter_experiment_justified" if justified else "prefer_prompt_or_retrieval"
        ),
        score_delta=delta,
        trainable_parameter_fraction_estimate=min(1.0, request.rank / 4096),
        executed_training=False,
        rationale=(
            "The lab compares an adapter hypothesis with a baseline. It never downloads or trains "
            "a model in the default installation."
        ),
    )
