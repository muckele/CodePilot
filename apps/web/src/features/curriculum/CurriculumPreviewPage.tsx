import { CurriculumMission } from "./components/CurriculumMission";
import { InvalidDayState } from "./components/InvalidDayState";
import { MissionError } from "./components/MissionError";
import { MissionLoading } from "./components/MissionLoading";
import { useCurriculumDay } from "./hooks/useCurriculumDay";

function parseDayNumber(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) {
    return null;
  }

  const dayNumber = Number(value);
  return Number.isSafeInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 365 ? dayNumber : null;
}

type VerifiedCurriculumPreviewProps = {
  dayNumber: number;
};

function VerifiedCurriculumPreview({ dayNumber }: VerifiedCurriculumPreviewProps) {
  const { state, retry } = useCurriculumDay(dayNumber);

  if (state.status === "loading") {
    return <MissionLoading />;
  }

  if (state.status === "error") {
    return <MissionError error={state.error} onRetry={retry} />;
  }

  return <CurriculumMission mission={state.data} />;
}

type CurriculumPreviewPageProps = {
  requestedDay?: string;
};

export function CurriculumPreviewPage({ requestedDay }: CurriculumPreviewPageProps) {
  const dayNumber = parseDayNumber(requestedDay);

  if (dayNumber === null) {
    return <InvalidDayState requestedDay={requestedDay} />;
  }

  return <VerifiedCurriculumPreview dayNumber={dayNumber} />;
}
