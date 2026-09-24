"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DAY_SAVED_EVENT } from "@/components/dashboard/useDailyHabits";
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
  memberKey: string;
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
 * The shared view of the table: the five roster seats only — always visible,
 * even before they have any points or have ever signed in. Joins happen by
 * `memberKey`: each seat looks up its profile and day logs under that key,
 * so the latest save of the day is what the table shows. Accounts without a
 * roster seat (test logins, e.g.) are ignored here so the family table stays
 * exactly five names; their own numbers still show on "Track Your Habits".
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

  // Refresh the table live whenever a day is saved from "Track Your Habits".
  useEffect(() => {
    const refreshOnSave = () => setNonce((value) => value + 1);
    window.addEventListener(DAY_SAVED_EVENT, refreshOnSave);
    return () => window.removeEventListener(DAY_SAVED_EVENT, refreshOnSave);
  }, []);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const rows = useMemo(() => {
    const byMemberKey = new Map<string, MemberStats>();
    for (const member of members) {
      if (member.memberKey) byMemberKey.set(member.memberKey, member);
    }
    const logsByMemberKey = new Map<string, DayLog[]>();
    for (const log of logs) {
      if (!log.memberKey) continue;
      const bucket = logsByMemberKey.get(log.memberKey) ?? [];
      bucket.push(log);
      logsByMemberKey.set(log.memberKey, bucket);
    }
    const currentUid = user?.uid ?? null;
    const result: GroupRow[] = [];

    // A seat resolves only through its roster key — profiles without a key
    // (guest accounts or records waiting for the one-time backfill on their
    // owner's next sign-in) never occupy a seat, so no outside account can
    // borrow a roster row or push points into it.
    for (const member of ROSTER) {
      const resolved = byMemberKey.get(member.key) ?? null;
      const memberLogs = logsByMemberKey.get(member.key) ?? [];
      // Records written before the key-based join carry no key; a keyed
      // profile still falls back to its own uid so no history disappears.
      const legacyLogs =
        resolved && memberLogs.length === 0
          ? logs.filter((log) => log.uid === resolved.uid)
          : [];
      const effectiveLogs = memberLogs.length > 0 ? memberLogs : legacyLogs;

      const weekHabitPoints = emptyCounts();
      for (const habit of HABITS) {
        weekHabitPoints[habit.id] = effectiveLogs.reduce(
          (total, log) => total + (log.checks[habit.id] ? habit.points : 0),
          0,
        );
      }

      result.push({
        key: resolved?.uid ?? member.key,
        name: resolved?.name ?? member.name,
        memberKey: member.key,
        color: resolved?.color ?? member.color,
        isYou: currentUid !== null && resolved?.uid === currentUid,
        hasAccount: Boolean(resolved),
        weekPoints: effectiveLogs.reduce((total, log) => total + log.points, 0),
        weekDays: effectiveLogs.length,
        weekHabitPoints,
        lifetimePoints: resolved?.lifetimePoints ?? 0,
        habitTotals: resolved?.habitTotals ?? emptyCounts(),
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
