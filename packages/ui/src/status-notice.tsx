import type { PropsWithChildren } from "react";

export type StatusTone = "info" | "success" | "error";

export type StatusNoticeProps = PropsWithChildren<{
  readonly tone?: StatusTone;
  readonly as?: "div" | "p";
  readonly className?: string;
}>;

export function StatusNotice({
  tone = "info",
  as: Element = "div",
  className,
  children
}: StatusNoticeProps) {
  const isError = tone === "error";

  return (
    <Element
      className={className}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {children}
    </Element>
  );
}
