"use client";

import MemberAvatar from "@/components/dashboard/MemberAvatar";
import { useGroupData } from "@/components/dashboard/useGroupData";
import { HABITS } from "@/lib/habits";

/**
 * "Track Table Habits" — the whole table for the current week: weekly points
 * per member, plus a compact breakdown of which habits produced them. Weekly
 * numbers are derived from the daily records, so the column resets itself
 * every Sunday while lifetime totals keep growing.
 */
export default function TrackTableHabitsPanel() {
  const { rows, loading, error, refresh, weekLabel } = useGroupData();

  const groupPoints = rows.reduce((total, row) => total + row.weekPoints, 0);
  const groupDays = rows.reduce((total, row) => total + row.weekDays, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-th-prussian">
            Track Table Habits
          </h2>
          <p className="mt-1 text-sm text-th-orient/80">
            Week of {weekLabel} · every submitted day is added to the week it
            belongs to.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-th-haze bg-white px-3 py-2 text-xs font-medium text-th-orient">
            {loading
              ? "Loading…"
              : `${groupPoints} pts across ${groupDays} days`}
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

      <div className="overflow-x-auto">
        <table
          id="habit-table"
          className="w-full min-w-[44rem] border-separate border-spacing-y-1 text-sm"
        >
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-th-orient/70">
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Days</th>
              <th className="px-3 py-2 font-medium">Week points</th>
              <th className="px-3 py-2 font-medium">Where they came from</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="rounded-l-lg border-y border-l border-th-haze bg-white px-3 py-3">
                  <div className="flex items-center gap-3">
                    <MemberAvatar name={row.name} color={row.color} size={36} />
                    <div className="min-w-0">
                      <p className="font-medium text-th-prussian">
                        {row.name}
                        {row.isYou ? (
                          <span className="ml-2 inline-block align-middle rounded-md bg-th-sky/40 px-1.5 py-0.5 text-[11px] font-medium text-th-regal">
                            you
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-th-orient/70">
                        {row.hasAccount ? row.email : "hasn't signed in yet"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="border-y border-th-haze bg-white px-3 py-3 text-th-orient">
                  {row.weekDays}/7
                </td>
                <td className="border-y border-th-haze bg-white px-3 py-3">
                  <span className="text-lg font-semibold text-th-prussian">
                    {row.weekPoints}
                  </span>
                  <span className="text-xs text-th-orient/70"> pts</span>
                </td>
                <td className="rounded-r-lg border-y border-r border-th-haze bg-white px-3 py-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {HABITS.map((habit) => {
                      const points = row.weekHabitPoints[habit.id];
                      return (
                        <span
                          key={habit.id}
                          title={habit.label}
                          className={`text-xs ${
                            points > 0
                              ? "font-medium text-th-regal"
                              : "text-th-orient/45"
                          }`}
                        >
                          {habit.short}{" "}
                          <span
                            className={
                              points > 0 ? "text-th-cerulean" : undefined
                            }
                          >
                            {points}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-xs text-th-orient/80">
              <td className="px-3 py-2 font-medium text-th-orient">
                Table total
              </td>
              <td className="px-3 py-2">
                {groupDays} {groupDays === 1 ? "day" : "days"}
              </td>
              <td className="px-3 py-2 font-semibold text-th-prussian">
                {groupPoints} pts
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {HABITS.map((habit) => (
                    <span key={habit.id} title={habit.label}>
                      {habit.short}{" "}
                      <span className="font-medium text-th-regal">
                        {rows.reduce(
                          (total, row) =>
                            total + row.weekHabitPoints[habit.id],
                          0,
                        )}
                      </span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-th-orient/70">
        Points come from each member&apos;s daily submissions (Quran 10,
        exercise 5, sugar 5, study 9, fast food 7, sleep 8). The week runs
        Sunday to Saturday and then starts again from zero — lifetime totals
        live on the Leaderboard tab.
      </p>
    </div>
  );
}

