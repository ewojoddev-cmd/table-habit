/**
 * TableHabit domain rules: habits, scoring, calendar helpers and the member
 * roster. Deliberately free of React and Firebase so it stays easy to reason
 * about (and to reuse from scripts).
 *
 * A "day" is the user's local calendar day and a "week" is seven local
 * calendar days starting on WEEK_START_DAY (Sunday) — so the weekly
 * leaderboard resets on its own when the calendar week flips, while lifetime
 * totals keep accumulating.
 */

export type HabitId =
  | "quran"
  | "exercise"
  | "sugar"
  | "study"
  | "fastFood"
  | "sleep";

export type Habit = {
  id: HabitId;
  /** Full label used on the daily checklist. */
  label: string;
  /** One-line explanation shown under the label. */
  detail: string;
  /** Compact label used in chips and breakdowns. */
  short: string;
  /** Points awarded when the habit is checked. */
  points: number;
};

/**
 * The six daily habits, in checklist order. Points are awarded per ticked box.
 */
export const HABITS: readonly Habit[] = [
  {
    id: "quran",
    label: "30M Quran",
    detail: "30 minutes of Quran",
    short: "Quran",
    points: 10,
  },
  {
    id: "exercise",
    label: "30M Exercise",
    detail: "30 minutes of exercise",
    short: "Exercise",
    points: 5,
  },
  {
    id: "sugar",
    label: "<15g Added Sugar",
    detail: "Under 15g of added sugar",
    short: "Sugar",
    points: 5,
  },
  {
    id: "study",
    label: "30M University Study",
    detail: "30 minutes of university study",
    short: "Study",
    points: 9,
  },
  {
    id: "fastFood",
    label: "No Fast Food",
    detail: "No fast food all day",
    short: "Fast food",
    points: 7,
  },
  {
    id: "sleep",
    label: "6+ Hours Sleep",
    detail: "Above 6 hours (optimally 7-9)",
    short: "Sleep",
    points: 8,
  },
];

/** A perfect day. */
export const MAX_DAILY_POINTS = HABITS.reduce(
  (total, habit) => total + habit.points,
  0,
);

export type HabitChecks = Record<HabitId, boolean>;
export type HabitCounts = Record<HabitId, number>;

export function emptyChecks(): HabitChecks {
  return HABITS.reduce<HabitChecks>((checks, habit) => {
    checks[habit.id] = false;
    return checks;
  }, {} as HabitChecks);
}

export function emptyCounts(): HabitCounts {
  return HABITS.reduce<HabitCounts>((counts, habit) => {
    counts[habit.id] = 0;
    return counts;
  }, {} as HabitCounts);
}

/** Coerce anything read back from Firestore into a complete checks map. */
export function normalizeChecks(value: unknown): HabitChecks {
  const checks = emptyChecks();
  if (!value || typeof value !== "object") return checks;
  const source = value as Record<string, unknown>;
  for (const habit of HABITS) {
    if (typeof source[habit.id] === "boolean") {
      checks[habit.id] = source[habit.id] as boolean;
    }
  }
  return checks;
}

/** Coerce anything read back from Firestore into a complete counts map. */
export function normalizeCounts(value: unknown): HabitCounts {
  const counts = emptyCounts();
  if (!value || typeof value !== "object") return counts;
  const source = value as Record<string, unknown>;
  for (const habit of HABITS) {
    const raw = Number(source[habit.id]);
    if (Number.isFinite(raw)) counts[habit.id] = raw;
  }
  return counts;
}

export function pointsFor(checks: HabitChecks): number {
  return HABITS.reduce(
    (total, habit) => total + (checks[habit.id] ? habit.points : 0),
    0,
  );
}

export function checkedCount(checks: HabitChecks): number {
  return HABITS.filter((habit) => checks[habit.id]).length;
}

/** Points contributed per habit for a single set of checks. */
export function pointsByHabit(checks: HabitChecks): HabitCounts {
  return HABITS.reduce<HabitCounts>((points, habit) => {
    points[habit.id] = checks[habit.id] ? habit.points : 0;
    return points;
  }, {} as HabitCounts);
}

/* ------------------------------------------------------------------ dates */

/** 0 = Sunday. Change this to shift where a week begins. */
export const WEEK_START_DAY = 0;

/** Local-time `YYYY-MM-DD` — the format stored in Firestore. */
export function dateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Midnight at the start of the week that contains `now`. */
export function weekStart(now: Date = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (start.getDay() - WEEK_START_DAY + 7) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export function weekStartKey(now: Date = new Date()): string {
  return dateKey(weekStart(now));
}

export function weekEndKey(now: Date = new Date()): string {
  const end = weekStart(now);
  end.setDate(end.getDate() + 6);
  return dateKey(end);
}

/** True when the day key falls inside the current calendar week. */
export function isInCurrentWeek(key: string, now: Date = new Date()): boolean {
  return key >= weekStartKey(now) && key <= weekEndKey(now);
}

export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function formatLongDate(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** e.g. "21 Sep – 27 Sep". */
export function formatWeekRange(now: Date = new Date()): string {
  return `${formatShortDate(weekStartKey(now))} – ${formatShortDate(weekEndKey(now))}`;
}

/* ------------------------------------------------------------------ roster */

export type Member = {
  name: string;
  email: string;
  /** Avatar fill — one solid colour per member (all-male table, no pinks). */
  color: string;
};

/** The five TableHabit accounts. The logins themselves live in Firebase Auth. */
export const ROSTER: readonly Member[] = [
  { name: "Mohammed", email: "mohammed@tablehabit.com", color: "#2f82c9" },
  { name: "Abdullah", email: "abdullah@tablehabit.com", color: "#0f766e" },
  { name: "Ammar", email: "ammar@tablehabit.com", color: "#b45309" },
  { name: "Yousef", email: "yousef@tablehabit.com", color: "#4f46e5" },
  { name: "Omar", email: "omar@tablehabit.com", color: "#15803d" },
];

/** Colours for accounts that are not on the roster (e.g. a test login). */
const GUEST_COLORS = [
  "#1d4ed8",
  "#0e7490",
  "#92400e",
  "#4338ca",
  "#166534",
  "#a16207",
];

function hashEmail(email: string): number {
  let hash = 5381;
  for (let index = 0; index < email.length; index += 1) {
    hash = (hash * 33) ^ email.charCodeAt(index);
  }
  return Math.abs(hash);
}

export type MemberIdentity = Member & { isMember: boolean };

/** Name + colour for any email, falling back gracefully for unknown accounts. */
export function identifyMember(email?: string | null): MemberIdentity {
  const normalized = (email ?? "").trim().toLowerCase();
  const member = ROSTER.find((candidate) => candidate.email === normalized);
  if (member) return { ...member, isMember: true };

  const local = normalized.split("@")[0] || "Member";
  const name = local.charAt(0).toUpperCase() + local.slice(1);
  return {
    name,
    email: normalized,
    color: GUEST_COLORS[hashEmail(normalized) % GUEST_COLORS.length],
    isMember: false,
  };
}

/** Up to two initials for the circular avatar. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}
