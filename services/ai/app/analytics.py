from __future__ import annotations

from dataclasses import dataclass

import pandas as pd  # type: ignore[import-untyped]
from sklearn.linear_model import LogisticRegression  # type: ignore[import-untyped]

from .schemas import ProgressEvent


@dataclass(frozen=True)
class ProgressProfile:
    total_returns: int
    core_completions: int
    recovery_wins: int
    average_minutes: float


def profile_progress(events: list[ProgressEvent]) -> ProgressProfile:
    if not events:
        return ProgressProfile(0, 0, 0, 0.0)
    frame = pd.DataFrame([event.model_dump() for event in events])
    return ProgressProfile(
        total_returns=int(frame["completed_date"].nunique()),
        core_completions=int((frame["mode"] == "core").sum()),
        recovery_wins=int((frame["mode"] == "recovery").sum()),
        average_minutes=round(float(frame["actual_minutes"].mean()), 2),
    )


class DeterministicSupportBaseline:
    """A tiny reproducible teaching baseline; it never makes a learner decision."""

    def __init__(self) -> None:
        features = [
            [0, 50, 0],
            [1, 20, 5],
            [2, 12, 10],
            [3, 8, 20],
            [5, 4, 28],
            [7, 0, 30],
        ]
        labels = [0, 0, 0, 1, 1, 1]
        self._model = LogisticRegression(
            random_state=0,
            solver="liblinear",
            max_iter=200,
        ).fit(features, labels)

    def support_score(
        self, rolling_7_day_returns: int, open_review_count: int, average_minutes: float
    ) -> float:
        probability = self._model.predict_proba(
            [[rolling_7_day_returns, min(open_review_count, 50), average_minutes]]
        )[0][1]
        return round(float(probability), 4)
