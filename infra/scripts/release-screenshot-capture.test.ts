import assert from "node:assert/strict";
import test from "node:test";

type CaptureReleaseScreenshotWhenEnabled = (
  operation: () => Promise<void>,
  environment?: Readonly<Record<string, string | undefined>>
) => Promise<boolean>;

const candidateModule = await import("../../e2e/support/release-screenshot-capture.js").catch(
  () => ({})
);
const captureReleaseScreenshotWhenEnabled = Reflect.get(
  candidateModule,
  "captureReleaseScreenshotWhenEnabled"
) as CaptureReleaseScreenshotWhenEnabled | undefined;

test("normal E2E does not write committed release screenshots", async () => {
  assert.equal(typeof captureReleaseScreenshotWhenEnabled, "function");
  let writes = 0;

  const captured = await captureReleaseScreenshotWhenEnabled(async () => {
    writes += 1;
  }, {});

  assert.equal(captured, false);
  assert.equal(writes, 0);
});

test("explicit release evidence capture performs the screenshot write once", async () => {
  assert.equal(typeof captureReleaseScreenshotWhenEnabled, "function");
  let writes = 0;

  const captured = await captureReleaseScreenshotWhenEnabled(
    async () => {
      writes += 1;
    },
    { CODELIFT_CAPTURE_RELEASE_SCREENSHOTS: "true" }
  );

  assert.equal(captured, true);
  assert.equal(writes, 1);
});
