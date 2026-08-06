type MissionIllustrationProps = {
  dayNumber: number;
};

export function MissionIllustration({ dayNumber }: MissionIllustrationProps) {
  return (
    <div className="mission-illustration" aria-hidden="true">
      <span className="mission-illustration__orbit mission-illustration__orbit--outer" />
      <span className="mission-illustration__orbit mission-illustration__orbit--inner" />
      <span className="mission-illustration__star mission-illustration__star--one" />
      <span className="mission-illustration__star mission-illustration__star--two" />
      <span className="mission-illustration__star mission-illustration__star--three" />
      <span className="mission-illustration__sun" />
      <span className="mission-illustration__peak mission-illustration__peak--back" />
      <span className="mission-illustration__peak mission-illustration__peak--front" />
      <span className="mission-illustration__path" />
      <span className="mission-illustration__day">{String(dayNumber).padStart(3, "0")}</span>
    </div>
  );
}
