"use client";

import MemberAvatar from "@/components/dashboard/MemberAvatar";
import {
  topHabits,
  useGroupData,
  type GroupRow,
} from "@/components/dashboard/useGroupData";

/** Competition ranking: members on equal points share a rank. */
function ranksFor(values: number[]): number[] {
  let previous: number | null = null;
  let rank = 0;
  return values.map((value, index) => {
    if (previous !== value) {
      rank = index + 1;
      previous = value;
    }
    return rank;
  });
}

function LeaderRow({
  rank,
  row,
  points,
  unit,
  meta,
}: {
  rank: number;
  row: GroupRow;
  points: number;
  unit: string;
  meta: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-th-haze bg-white px-3 py-3">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-semibold ${
          rank === 1 ? "bg-th-mariner text-white" : "bg-th-mist text-th-regal"
        }`}
      >
        {rank}
      </span>
      <MemberAvatar name={row.name} color={row.color} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-th-prussian">
          {row.name}
          {row.isYou ? (
            <span className="ml-2 inline-block align-middle rounded-md bg-th-sky/40 px-1.5 py-0.5 text-[11px] font-medium text-th-regal">
              you
            </span>
          ) : null}
        </p>
        <p className="text-xs text-th-orient/70">{meta}</p>
      </div>
      <p className="shrink-0 text-right">
        <span className="text-lg font-semibold text-th-prussian">{points}</span>
        <span className="text-xs text-th-orient/70"> {unit}</span>
      </p>
    </li>
  );
}

/**
 * "Leaderboard" — the weekly race next to the all-time table. Weekly points
 * are derived from this week's day records (so they reset every Sunday);
 * lifetime points are the running total on each profile document.
 */
export default function LeaderboardPanel() {
  const { rows, loading, error, refresh, weekLabel } = useGroupData();

  const byWeek = [...rows].sort(
    (a, b) => b.weekPoints - a.weekPoints || a.name.localeCompare(b.name),
  );
  const byLifetime = [...rows].sort(
    (a, b) => b.lifetimePoints - a.lifetimePoints || a.name.localeCompare(b.name),
  );
  const weekRanks = ranksFor(byWeek.map((row) => row.weekPoints));
  const lifetimeRanks = ranksFor(byLifetime.map((row) => row.lifetimePoints));
  const you = rows.find((row) => row.isYou) ?? null;
  const breakdown = you ? topHabits(you.habitTotals, 6) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-th-prussian">Leaderboard</h2>
          <p className="mt-1 text-sm text-th-orient/80">
            The week resets every Sunday; lifetime points never do.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-th-haze bg-white px-3 py-2 text-xs font-medium text-th-orient">
            {loading ? "Loading…" : `Week of ${weekLabel}`}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-th-haze px-3 py-1.5 text-sm font-medium text-th-regal transition-colors hover:border-th-sky hover:text-th-cerulean focus:outline-none focus-visible:ring-2 focus-visible:ring-th-sky"
          >
            Refresh
          </button>
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

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-th-prussian">
            Leaderboard of the Week
          </h3>
          <p className="text-xs text-th-orient/75">
            Week of {weekLabel} · points from days submitted this week
          </p>
        </div>
        <ol id="weekly-leaderboard" className="space-y-2">
          {byWeek.map((row, index) => (
            <LeaderRow
              key={row.key}
              rank={weekRanks[index]}
              row={row}
              points={row.weekPoints}
              unit="pts"
              meta={`${row.weekDays} ${row.weekDays === 1 ? "day" : "days"} recorded this week`}
            />
          ))}
        </ol>
        <p className="text-xs text-th-orient/70">
          Zero for everyone on Sunday morning — the week starts fresh.
        </p>
      </section>

      <section className="space-y-3 border-t border-th-haze pt-6">
        <div>
          <h3 className="text-base font-semibold text-th-prussian">
            Total Lifetime Points
          </h3>
          <p className="text-xs text-th-orient/75">
            Every day ever recorded, added up · never resets
          </p>
        </div>
        <ol id="lifetime-leaderboard" className="space-y-2">
          {byLifetime.map((row, index) => (
            <LeaderRow
              key={row.key}
              rank={lifetimeRanks[index]}
              row={row}
              points={row.lifetimePoints}
              unit="pts"
              meta="lifetime total · never resets"
            />
          ))}
        </ol>

        {you ? (
          <div className="rounded-xl border border-th-haze bg-white/70 p-4">
            <p className="text-sm font-medium text-th-prussian">
              Where your lifetime points come from
            </p>
            {breakdown.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {breakdown.map(({ habit, count, points }) => (
                  <li key={habit.id} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-th-orient">
                      {habit.short}
                    </span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-th-mist">
                      <span
                        className="block h-full rounded-full bg-th-mariner"
                        style={{
                          width: `${you.lifetimePoints > 0 ? Math.round((points / you.lifetimePoints) * 100) : 0}%`,
                        }}
                      />
                    </span>
                    <span className="w-44 shrink-0 text-right text-xs text-th-orient/80">
                      {count} {count === 1 ? "day" : "days"} × {habit.points} ={" "}
                      <span className="font-semibold text-th-prussian">
                        {points}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-th-orient/70">
                Nothing recorded yet — tick your habits on “Track Your Habits”
                and submit the day.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
