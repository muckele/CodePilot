import { useCallback, useEffect, useMemo, useState } from "react";

import { CurriculumLoadError, fetchCurriculumDay } from "../api/fetchCurriculumDay";
import type { CurriculumDayResponse } from "@codelift/contracts";

type CurriculumDayState =
  | {
      status: "loading";
      dayNumber: number;
    }
  | {
      status: "success";
      dayNumber: number;
      data: CurriculumDayResponse;
    }
  | {
      status: "error";
      dayNumber: number;
      error: CurriculumLoadError;
    };

function normalizeLoadError(error: unknown): CurriculumLoadError {
  if (error instanceof CurriculumLoadError) {
    return error;
  }

  return new CurriculumLoadError({
    kind: "network",
    message: "CodeLift could not verify this mission. Please try the request again."
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useCurriculumDay(dayNumber: number) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CurriculumDayState>({
    status: "loading",
    dayNumber
  });

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    setState({
      status: "loading",
      dayNumber
    });

    void fetchCurriculumDay(dayNumber, abortController.signal)
      .then((data) => {
        if (active) {
          setState({
            status: "success",
            dayNumber,
            data
          });
        }
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setState({
            status: "error",
            dayNumber,
            error: normalizeLoadError(error)
          });
        }
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, [attempt, dayNumber]);

  const retry = useCallback(() => {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  return useMemo(() => {
    if (state.dayNumber !== dayNumber) {
      return {
        state: {
          status: "loading",
          dayNumber
        } as const,
        retry
      };
    }

    return {
      state,
      retry
    };
  }, [dayNumber, retry, state]);
}
