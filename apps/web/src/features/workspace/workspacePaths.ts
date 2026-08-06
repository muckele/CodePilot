const workspacePaths = [
  "/app/roadmap",
  "/app/reviews",
  "/app/skills",
  "/app/portfolio",
  "/app/errors",
  "/app/tasks",
  "/app/search",
  "/app/coach",
  "/app/planner",
  "/app/evals",
  "/app/gallery"
] as const;

export function workspacePathsForEnvironment(development: boolean): Set<string> {
  return new Set([...workspacePaths, ...(development ? (["/admin"] as const) : [])]);
}
