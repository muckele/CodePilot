/** Stable curriculum boundaries shared by request parsing and browser inputs. */
export const CURRICULUM_LIMITS = Object.freeze({
  firstDay: 1,
  lastDay: 365
} as const);

/** Limits for the tenant-scoped private-note workflow. Runtime contracts remain authoritative. */
export const PRIVATE_NOTE_LIMITS = Object.freeze({
  titleCharacters: 120,
  contentCharacters: 20_000,
  questionCharacters: 1_000
} as const);

/** Transport limits that are deliberately fixed across environments. */
export const HTTP_LIMITS = Object.freeze({
  jsonBody: "32kb"
} as const);

/** Canonical browser paths. Keeping these as literals preserves router type narrowing. */
export const PRODUCT_PATHS = Object.freeze({
  root: "/",
  register: "/register",
  login: "/login",
  curriculumPreview: "/curriculum/1",
  onboarding: "/app/onboarding",
  today: "/app/today",
  account: "/app/account",
  accountDeletion: "/app/account/delete",
  roadmap: "/app/roadmap",
  reviews: "/app/reviews",
  skills: "/app/skills",
  portfolio: "/app/portfolio",
  errors: "/app/errors",
  tasks: "/app/tasks",
  search: "/app/search",
  coach: "/app/coach",
  planner: "/app/planner",
  evals: "/app/evals",
  gallery: "/app/gallery",
  admin: "/admin"
} as const);

export type ProductPath = (typeof PRODUCT_PATHS)[keyof typeof PRODUCT_PATHS];

/** Safe post-authentication destinations available in every environment. */
export const AUTHENTICATED_RETURN_PATHS = Object.freeze([
  PRODUCT_PATHS.today,
  PRODUCT_PATHS.onboarding,
  PRODUCT_PATHS.account,
  PRODUCT_PATHS.accountDeletion,
  PRODUCT_PATHS.roadmap,
  PRODUCT_PATHS.reviews,
  PRODUCT_PATHS.skills,
  PRODUCT_PATHS.portfolio,
  PRODUCT_PATHS.errors,
  PRODUCT_PATHS.tasks,
  PRODUCT_PATHS.search,
  PRODUCT_PATHS.coach,
  PRODUCT_PATHS.planner,
  PRODUCT_PATHS.evals,
  PRODUCT_PATHS.gallery
] as const);
