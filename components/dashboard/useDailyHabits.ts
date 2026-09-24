"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  clearDraft,
  ensureProfile,
  friendlyDbError,
  loadDayLog,
  loadDraft,
  saveDraft,
  submitDay,
} from "@/lib/firestore";
import {
  emptyChecks,
  formatShortDate,
  identifyMember,
  msUntilNextLocalMidnight,
  pointsFor,
  todayKey,
  type HabitChecks,
  type HabitId,
} from "@/lib/habits";

export type DailyStatus = "loading" | "ready" | "submitting" | "submitted";

export type DailyHabits = {
  /** The local day on screen, `YYYY-MM-DD`. */
  day: string;
  checks: HabitChecks;
  points: number;
  status: DailyStatus;
  /** Set once today exists in Firestore, which locks the checklist. */
  submitted: { points: number; auto: boolean } | null;
  /** Auto-submit / recovery note, e.g. an unfinished day was closed. */
  notice: string | null;
  error: string | null;
  toggle: (id: HabitId) => void;
  submit: () => void;
};

type Snapshot = {
  uid: string | null;
  email: string | null;
  day: string;
  checks: HabitChecks;
  submitted: DailyHabits["submitted"];
};

/**
 * Owns today's checklist: mirrors ticks to `drafts/{uid}`, records the day on
 * submit, and closes the day automatically once the local clock passes
 * midnight (or when a stale draft is found on the next visit).
 */
export function useDailyHabits(): DailyHabits {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const email = user?.email ?? null;

  const [day, setDay] = useState(() => todayKey());
  const [checks, setChecks] = useState<HabitChecks>(emptyChecks);
  const [submitted, setSubmitted] = useState<DailyHabits["submitted"]>(null);
  const [status, setStatus] = useState<DailyStatus>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Latest values, readable from timers and async work. */
  const latest = useRef<Snapshot>({ uid, email, day, checks, submitted });
  latest.current = { uid, email, day, checks, submitted };

  /** Write one day to Firestore and drop the draft. */
  const recordDay = useCallback(
    async (input: { date: string; checks: HabitChecks; auto: boolean }) => {
      const { uid: currentUid, email: currentEmail } = latest.current;
      if (!currentUid) return 0;
      const outcome = await submitDay({
        uid: currentUid,
        email: currentEmail ?? "",
        name: identifyMember(currentEmail).name,
        date: input.date,
        checks: input.checks,
        auto: input.auto,
      });
      await clearDraft(currentUid);
      return outcome.points;
    },
    [],
  );

  /** Load whatever Firestore already knows about `target`, then fill the gap. */
  const syncDay = useCallback(
    async (target: string) => {
      const { uid: currentUid, email: currentEmail } = latest.current;
      if (!currentUid) return;
      setStatus("loading");
      setError(null);
      try {
        await ensureProfile({ uid: currentUid, email: currentEmail });

        const recorded = await loadDayLog(currentUid, target);
        if (recorded) {
          setChecks(recorded.checks);
          setSubmitted({ points: recorded.points, auto: recorded.auto });
          setStatus("submitted");
          setNotice(null);
          return;
        }

        const draft = await loadDraft(currentUid);
        if (draft && draft.date === target) {
          setChecks(draft.checks);
          setSubmitted(null);
          setStatus("ready");
          setNotice(null);
          return;
        }

        if (draft) {
          // The app closed before the day ended, so close that day now.
          const points = await recordDay({
            date: draft.date,
            checks: draft.checks,
            auto: true,
          });
          setNotice(
            `Your ${formatShortDate(draft.date)} checklist was submitted automatically: ${points} ${points === 1 ? "point" : "points"}.`,
          );
        } else {
          setNotice(null);
        }

        setChecks(emptyChecks());
        setSubmitted(null);
        setStatus("ready");
      } catch (cause) {
        setError(friendlyDbError(cause));
        setChecks(emptyChecks());
        setSubmitted(null);
        setStatus("ready");
      }
    },
    [recordDay],
  );

  useEffect(() => {
    if (!uid) {
      setStatus("loading");
      return;
    }
    void syncDay(todayKey());
  }, [uid, syncDay]);

  // Close the day when the local clock rolls past midnight, and catch up if
  // the tab was asleep (laptop lid closed) or the machine changed day.
  useEffect(() => {
    if (!uid) return undefined;

    let timer: ReturnType<typeof setTimeout>;

    const closeDay = async () => {
      const snapshot = latest.current;
      if (snapshot.submitted) return;
      try {
        if (Object.values(snapshot.checks).some(Boolean)) {
          await recordDay({
            date: snapshot.day,
            checks: snapshot.checks,
            auto: true,
          });
        } else if (snapshot.uid) {
          // Nothing was ticked, so there is no day worth recording.
          await clearDraft(snapshot.uid);
        }
      } catch {
        // The next sync surfaces any problem; a timer must never throw.
      }
    };

    const rollOver = async () => {
      await closeDay();
      const next = todayKey();
      setDay(next);
      await syncDay(next);
      schedule();
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void rollOver(),
        msUntilNextLocalMidnight() + 1500,
      );
    };
    schedule();

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        todayKey() !== latest.current.day
      ) {
        void rollOver();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [uid, recordDay, syncDay]);

  const toggle = useCallback((id: HabitId) => {
    const snapshot = latest.current;
    if (snapshot.submitted || !snapshot.uid) return;
    const next: HabitChecks = { ...snapshot.checks, [id]: !snapshot.checks[id] };
    setChecks(next);
    setNotice(null);
    setError(null);
    void saveDraft(snapshot.uid, snapshot.day, next).catch((cause) =>
      setError(friendlyDbError(cause)),
    );
  }, []);

  const submit = useCallback(() => {
    void (async () => {
      const snapshot = latest.current;
      if (!snapshot.uid || snapshot.submitted) return;
      setStatus("submitting");
      setError(null);
      try {
        const earned = await recordDay({
          date: snapshot.day,
          checks: snapshot.checks,
          auto: false,
        });
        setSubmitted({ points: earned, auto: false });
        setStatus("submitted");
        setNotice(null);
      } catch (cause) {
        setError(friendlyDbError(cause));
        setStatus("ready");
      }
    })();
  }, [recordDay]);

  return {
    day,
    checks,
    points: pointsFor(checks),
    status,
    submitted,
    notice,
    error,
    toggle,
    submit,
  };
}
