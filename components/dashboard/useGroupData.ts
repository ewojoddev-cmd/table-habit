"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchLogsSince,
  fetchMembers,
  friendlyDbError,
  type DayLog,
  type MemberStats,
} from "@/lib/firestore";
import {
  HABITS,
  ROSTER,
  emptyCounts,
  formatShortDate,
  weekEndKey,
  weekStartKey,
  type HabitCounts,
} from "@/lib/habits";

export type GroupRow = {
  key: string;
  name: string;
  email: string;
  color: string;
  /** Is this the signed-in user? */
  isYou: boolean;
  /** True once the account has a profile document in Firestore. */
  hasAccount: boolean;
  weekPoints: number;
  /** How many days were recorded this week. */
  weekDays: number;
  /** Points contributed by each habit this week. */
  weekHabitPoints: HabitCounts;
  lifetimePoints: number;
  daysSubmitted: number;
  /** Lifetime count of days each habit was completed. */
  habitTotals: HabitCounts;
};

export type GroupData = {
  rows: GroupRow[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** e.g. "21 Sep – 27 Sep". */
  weekLabel: string;
  weekStart: string;
};

/**
 * The shared view of the table: the five roster accounts only — always visible,
 * even before they have any points or have ever signed in. Accounts that are
 * not on the roster (test logins, e.g.) are ignored here so the family table
 * stays exactly five names; their own numbers still show on "Track Your
 * Habits".
 */
export function useGroupData(): GroupData {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => weekStartKey());
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = weekStartKey();
    setWeekStart(start);
    try {
      const [nextMembers, nextLogs] = await Promise.all([
        fetchMembers(),
        fetchLogsSince(start),
      ]);
      setMembers(nextMembers);
      setLogs(nextLogs);
    } catch (cause) {
      setError(friendlyDbError(cause));
      setMembers([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const rows = useMemo(() => {
    const byEmail = new Map(
      members.map((member) => [member.email.toLowerCase(), member]),
    );
    const currentEmail = user?.email?.toLowerCase() ?? null;
    const result: GroupRow[] = [];

    for (const member of ROSTER) {
      const stats = byEmail.get(member.email.toLowerCase());
      const uid = stats?.uid ?? null;
      const memberLogs = uid ? logs.filter((log) => log.uid === uid) : [];

      const weekHabitPoints = emptyCounts();
      for (const habit of HABITS) {
        weekHabitPoints[habit.id] = memberLogs.reduce(
          (total, log) => total + (log.checks[habit.id] ? habit.points : 0),
          0,
        );
      }

      result.push({
        key: uid ?? member.email,
        name: stats?.name ?? member.name,
        email: member.email,
        color: stats?.color ?? member.color,
        isYou:
          currentEmail !== null && currentEmail === member.email.toLowerCase(),
        hasAccount: Boolean(stats),
        weekPoints: memberLogs.reduce((total, log) => total + log.points, 0),
        weekDays: memberLogs.length,
        weekHabitPoints,
        lifetimePoints: stats?.lifetimePoints ?? 0,
        daysSubmitted: stats?.daysSubmitted ?? 0,
        habitTotals: stats?.habitTotals ?? emptyCounts(),
      });
    }

    return result;
  }, [logs, members, user]);

  return {
    rows,
    loading,
    error,
    refresh,
    weekStart,
    weekLabel: `${formatShortDate(weekStart)} – ${formatShortDate(weekEndKey())}`,
  };
}

/** Points from the habits, biggest contribution first. */
export function topHabits(
  counts: HabitCounts,
  limit = 3,
): { habit: (typeof HABITS)[number]; count: number; points: number }[] {
  return HABITS.map((habit) => ({
    habit,
    count: counts[habit.id],
    points: counts[habit.id] * habit.points,
  }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}
