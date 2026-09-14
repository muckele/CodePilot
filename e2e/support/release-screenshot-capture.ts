export async function captureReleaseScreenshotWhenEnabled(
  operation: () => Promise<void>,
  environment: Readonly<Record<string, string | undefined>> = process.env
): Promise<boolean> {
  if (environment.CODELIFT_CAPTURE_RELEASE_SCREENSHOTS !== "true") return false;

  await operation();
  return true;
}
