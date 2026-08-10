from datetime import date

from fastapi.testclient import TestClient

from app.analytics import profile_progress
from app.main import app
from app.providers import lexical_score, mock_embedding
from app.schemas import ProgressEvent

client = TestClient(app)


def test_health_requires_no_model_download() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "codelift-ai",
        "provider": "mock",
        "model_download_required": False,
    }


def test_progress_analysis_keeps_core_and_recovery_distinct() -> None:
    response = client.post(
        "/v1/analyze/progress",
        json={
            "today": "2026-07-24",
            "events": [
                {
                    "day_number": 1,
                    "mode": "core",
                    "completed_date": "2026-07-24",
                    "actual_minutes": 30,
                },
                {
                    "day_number": 2,
                    "mode": "recovery",
                    "completed_date": "2026-07-23",
                    "actual_minutes": 5,
                },
            ],
        },
    )
    assert response.status_code == 200
    assert response.json()["core_completions"] == 1
    assert response.json()["recovery_wins"] == 1
    assert response.json()["total_returns"] == 2


def test_risk_assist_never_makes_the_human_decision() -> None:
    response = client.post(
        "/v1/ml/risk-assist",
        json={
            "rolling_7_day_returns": 0,
            "open_review_count": 50,
            "average_minutes": 0,
        },
    )
    assert response.status_code == 200
    assert response.json()["human_decision_required"] is True
    assert response.json()["band"] == "offer_planning"


def test_embeddings_are_deterministic_and_bounded() -> None:
    first = mock_embedding("observable state transition", 16)
    second = mock_embedding("observable state transition", 16)
    assert first == second
    assert len(first) == 16
    assert abs(sum(value * value for value in first) - 1) < 1e-9


def test_embedding_endpoint_rejects_extra_fields() -> None:
    response = client.post(
        "/v1/embeddings",
        json={"texts": ["one"], "dimensions": 16, "secret": "not allowed"},
    )
    assert response.status_code == 422


def test_reranker_uses_query_evidence() -> None:
    response = client.post(
        "/v1/rerank",
        json={
            "query": "csrf exact origin",
            "candidates": [
                {"candidate_id": "a", "text": "CSS grid and layout"},
                {"candidate_id": "b", "text": "CSRF validates an exact Origin"},
            ],
            "top_k": 2,
        },
    )
    assert response.status_code == 200
    assert response.json()["results"][0]["candidate_id"] == "b"
    assert lexical_score("csrf origin", "CSRF exact Origin") == 1


def test_coach_labels_generation_and_preserves_evidence_boundary() -> None:
    response = client.post(
        "/v1/coach",
        json={
            "action": "explain",
            "day_number": 15,
            "title": "Understand the cascade",
            "principle": "Specificity resolves competing declarations.",
            "artifact": "A specificity test.",
            "learner_text": "I think source order always wins.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "python_mock"
    assert "does not claim understanding" in payload["evidence_boundary"]
    assert "employment" in payload["safety_note"]


def test_local_generation_downloads_nothing() -> None:
    response = client.post(
        "/v1/local/generate",
        json={"prompt": "Give one next step", "model_id": "mock-local"},
    )
    assert response.status_code == 200
    assert response.json()["downloaded_model"] is False


def test_peft_lab_prefers_simpler_levers_without_evidence() -> None:
    response = client.post(
        "/v1/labs/peft",
        json={
            "examples": 20,
            "rank": 8,
            "baseline_score": 0.7,
            "adapter_score": 0.71,
        },
    )
    assert response.status_code == 200
    assert response.json()["recommendation"] == "prefer_prompt_or_retrieval"
    assert response.json()["executed_training"] is False


def test_malformed_progress_input_fails_closed() -> None:
    response = client.post(
        "/v1/analyze/progress",
        json={
            "today": "not-a-date",
            "events": [],
        },
    )
    assert response.status_code == 422


def test_impossible_calendar_dates_fail_at_the_http_boundary() -> None:
    response = client.post(
        "/v1/analyze/progress",
        json={
            "today": "2026-02-30",
            "events": [],
        },
    )
    assert response.status_code == 422


def test_embedding_text_is_bounded_at_the_http_boundary() -> None:
    response = client.post(
        "/v1/embeddings",
        json={"texts": ["x" * 8_001], "dimensions": 16},
    )
    assert response.status_code == 422


def test_pandas_profile_preserves_distinct_modes() -> None:
    profile = profile_progress(
        [
            ProgressEvent(
                day_number=1,
                mode="core",
                completed_date=date(2026, 7, 24),
                actual_minutes=30,
            ),
            ProgressEvent(
                day_number=2,
                mode="recovery",
                completed_date=date(2026, 7, 24),
                actual_minutes=5,
            ),
        ]
    )
    assert profile.total_returns == 1
    assert profile.core_completions == 1
    assert profile.recovery_wins == 1
    assert profile.average_minutes == 17.5
