import type { ReactNode } from "react";

export interface StatePanelAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface StatePanelProps {
  readonly kind: "loading" | "error" | "empty";
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly action?: StatePanelAction;
  readonly headingLevel?: 1 | 2 | 3;
  readonly className?: string;
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(" ");
}

export function StatePanel({
  kind,
  title,
  description,
  eyebrow,
  action,
  headingLevel = 1,
  className
}: StatePanelProps) {
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h1";
  const isError = kind === "error";

  return (
    <section
      className={joinClassNames("mission-card", "workspace-state", className)}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-busy={kind === "loading" ? true : undefined}
    >
      {kind === "loading" ? <span className="state-orb" aria-hidden="true" /> : null}
      {eyebrow === undefined ? null : <p className="eyebrow">{eyebrow}</p>}
      <Heading>{title}</Heading>
      <p>{description}</p>
      {action === undefined ? null : (
        <button className="button button--primary" type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
}
