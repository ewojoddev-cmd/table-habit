"use client";

import { useDailyHabits } from "@/components/dashboard/useDailyHabits";
import {
  HABITS,
  MAX_DAILY_POINTS,
  checkedCount,
  formatLongDate,
  formatWeekRange,
  todayKey,
} from "@/lib/habits";

/**
 * "Track Your Habits" — today's date, the six habit boxes, a live points
 * preview and the submit button. Ticks are mirrored to Firestore as a draft,
 * and the day is closed automatically at midnight if it is never submitted.
 */
export default function TrackYourHabitsPanel() {
  const {
    day,
    checks,
    points,
    status,
    submitted,
    notice,
    error,
    toggle,
    submit,
  } = useDailyHabits();

  const locked = status === "submitted";
  const busy = status === "loading";
  const pending = status === "submitting";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-th-orient/70">
            {day === todayKey() ? "Today" : "Day"}
          </p>
          <h2
            id="habit-date"
            className="mt-1 text-xl font-semibold text-th-prussian"
          >
            {formatLongDate(day)}
          </h2>
          <p className="mt-1 text-sm text-th-orient/80">
            Week of {formatWeekRange()} · checkboxes reset every day
          </p>
        </div>

        <div className="rounded-xl border border-th-haze bg-white px-4 py-3 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-th-orient/70">
            Selected
          </p>
          <p
            id="habit-points"
            className="text-2xl font-semibold text-th-prussian"
          >
            {points}{" "}
            <span className="text-base font-normal text-th-orient/70">
              / {MAX_DAILY_POINTS} pts
            </span>
          </p>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-th-cerulean bg-white px-4 py-3 text-sm font-medium text-th-regal"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-xl border border-th-sky bg-white px-4 py-3 text-sm text-th-regal">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {HABITS.map((habit) => {
          const checked = checks[habit.id];
          return (
            <label
              key={habit.id}
              htmlFor={`habit-${habit.id}`}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                checked
                  ? "border-th-mariner bg-white"
                  : "border-th-haze bg-white/60 hover:border-th-sky"
              } ${locked || busy ? "cursor-default opacity-80" : "cursor-pointer"}`}
            >
              <input
                id={`habit-${habit.id}`}
                name={habit.id}
                type="checkbox"
                checked={checked}
                disabled={locked || busy}
                onChange={() => toggle(habit.id)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-th-mariner"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-th-prussian">
                  {habit.label}
                </span>
                <span className="block text-xs text-th-orient/75">
                  {habit.detail}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
                  checked
                    ? "bg-th-mariner text-white"
                    : "bg-th-mist text-th-orient/70"
                }`}
              >
                {habit.points > 0 ? `+${habit.points}` : "no pts yet"}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-th-haze pt-4">
        <p id="habit-status" className="text-sm text-th-orient/80">
          {status === "loading" ? "Loading today's checklist…" : null}
          {pending ? "Submitting…" : null}
          {locked && submitted
            ? `Recorded ${submitted.points} pts for today${submitted.auto ? " (closed automatically)" : ""}.`
            : null}
          {status === "ready"
            ? `Checked ${checkedCount(checks)} of ${HABITS.length} habits.`
            : null}
        </p>

        <button
          id="habit-submit"
          type="button"
          onClick={submit}
          disabled={locked || busy || pending}
          className="rounded-xl bg-th-mariner px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-th-cerulean focus:outline-none focus-visible:ring-2 focus-visible:ring-th-cerulean focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-th-sky"
        >
          {locked ? "Submitted" : pending ? "Submitting…" : "Submit today"}
        </button>
      </div>

      <p className="text-xs text-th-orient/70">
        Every day is recorded once: submit it yourself, or let midnight close
        it with whatever is ticked. Points then feed the weekly table and the
        leaderboards.
      </p>
    </div>
  );
}

