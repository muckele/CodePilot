import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatePanel, StatusNotice } from "../src/index.js";

describe("StatePanel", () => {
  it("announces loading state politely and marks the region busy", () => {
    const markup = renderToStaticMarkup(
      <StatePanel kind="loading" title="Loading verified data…" description="Please wait." />
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('class="state-orb"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it("uses an assertive alert and an explicit button for recoverable errors", () => {
    const markup = renderToStaticMarkup(
      <StatePanel
        kind="error"
        eyebrow="Verified data unavailable"
        title="No invented state was shown."
        description="The request failed."
        action={{ label: "Try again", onClick: () => undefined }}
      />
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain(
      '<button class="button button--primary" type="button">Try again</button>'
    );
    expect(markup).not.toContain('class="state-orb"');
  });
});

describe("StatusNotice", () => {
  it("supports polite paragraph statuses and assertive error notices", () => {
    expect(renderToStaticMarkup(<StatusNotice as="p">3 matching records.</StatusNotice>)).toContain(
      '<p role="status" aria-live="polite">3 matching records.</p>'
    );

    expect(
      renderToStaticMarkup(<StatusNotice tone="error">The request failed.</StatusNotice>)
    ).toContain('<div role="alert" aria-live="assertive">The request failed.</div>');
  });
});
