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
  HABITS,
  emptyChecks,
  formatShortDate,
  memberKeyForLogin,
  msUntilNextLocalMidnight,
  pointsFor,
  todayKey,
  type HabitChecks,
  type HabitId,
} from "@/lib/habits";

export type DailyStatus = "loading" | "ready" | "submitting" | "saved";

/** Latest submitted points plus whether the day had previous saves. */
export type DailySaved = { points: number; auto: boolean; updated: boolean };

export type DailyHabits = {
  /** The local day on screen, `YYYY-MM-DD`. */
  day: string;
  checks: HabitChecks;
  points: number;
  status: DailyStatus;
  /** Latest saved record for today, if the day has been submitted. */
  submitted: DailySaved | null;
  /** True when the on-screen ticks differ from the last submitted record. */
  dirty: boolean;
  /** Auto-submit / recovery note, e.g. an unfinished day was closed. */
  notice: string | null;
  error: string | null;
  toggle: (id: HabitId) => void;
  submit: () => void;
};

/** A custom event other panels listen to so the table refreshes on save. */
export const DAY_SAVED_EVENT = "tablehabit:day-saved";

function checksEqual(a: HabitChecks, b: HabitChecks | null): boolean {
  if (!b) return false;
  return HABITS.every((habit) => a[habit.id] === b[habit.id]);
}

/**
 * Owns today's checklist: mirrors ticks to `drafts/{uid}`, saves the day on
 * submit, and closes the day automatically once the local clock passes
 * midnight (or when a stale draft is found on the next visit). Saving is a
 * live update — the day stays editable and every save overwrites the same
 * record, so the table and leaderboards always show the latest numbers.
 */
export function useDailyHabits(): DailyHabits {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const userEmail = user?.email ?? null;
  const memberKey = memberKeyForLogin(userEmail);

  const [day, setDay] = useState(() => todayKey());
  const [checks, setChecks] = useState<HabitChecks>(emptyChecks);
  const [savedChecks, setSavedChecks] = useState<HabitChecks | null>(null);
  const [submitted, setSubmitted] = useState<DailyHabits["submitted"]>(null);
  const [status, setStatus] = useState<DailyStatus>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const savedChecksRef = useRef(savedChecks);
  savedChecksRef.current = savedChecks;

  /** Latest values, readable from timers and async work. */
  const latest = useRef({ uid, memberKey, userEmail, day, checks });
  latest.current = { uid, memberKey, userEmail, day, checks };

  /** Write one day to Firestore and drop the draft. */
  const recordDay = useCallback(
    async (input: { date: string; checks: HabitChecks; auto: boolean }) => {
      const current = latest.current;
      if (!current.uid) return { points: 0, updated: false };
      const outcome = await submitDay({
        uid: current.uid,
        memberKey: current.memberKey,
        name: "",
        date: input.date,
        checks: input.checks,
        auto: input.auto,
      });
      await clearDraft(current.uid);
      return outcome;
    },
    [],
  );

  /** Load whatever Firestore already knows about `target`, then fill the gap. */
  const syncDay = useCallback(
    async (target: string) => {
      const current = latest.current;
      if (!current.uid) return;
      setStatus("loading");
      setError(null);
      try {
        await ensureProfile({
          uid: current.uid,
          email: current.userEmail,
        });

        const recorded = await loadDayLog(current.uid, target);
        if (recorded) {
          setChecks(recorded.checks);
          setSavedChecks(recorded.checks);
          setSubmitted({
            points: recorded.points,
            auto: recorded.auto,
            updated: true,
          });
          setStatus("saved");
          setNotice(null);
          return;
        }

        const draft = await loadDraft(current.uid);
        if (draft && draft.date === target) {
          setChecks(draft.checks);
          setSavedChecks(null);
          setSubmitted(null);
          setStatus("ready");
          setNotice(null);
          return;
        }

        if (draft) {
          // The app closed before the day ended, so close that day now.
          const outcome = await recordDay({
            date: draft.date,
            checks: draft.checks,
            auto: true,
          });
          setNotice(
            `Your ${formatShortDate(draft.date)} checklist was saved automatically: ${outcome.points} ${outcome.points === 1 ? "point" : "points"}.`,
          );
        } else {
          setNotice(null);
        }

        setChecks(emptyChecks());
        setSavedChecks(null);
        setSubmitted(null);
        setStatus("ready");
      } catch (cause) {
        setError(friendlyDbError(cause));
        setChecks(emptyChecks());
        setSavedChecks(null);
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
      if (!snapshot.uid) return;
      try {
        // If anything is ticked, close the day even when it was already
        // saved — the explicit save below simply overwrites that record.
        // Fully unticked days keep their last saved record if they have
        // one (an explicit "nothing today" update); days never saved at
        // all leave no record behind.
        const prior = await loadDayLog(snapshot.uid, snapshot.day);
        if (Object.values(snapshot.checks).some(Boolean) || prior) {
          await submitDay({
            uid: snapshot.uid,
            memberKey: snapshot.memberKey,
            name: "",
            date: snapshot.day,
            checks: snapshot.checks,
            auto: true,
          });
          await clearDraft(snapshot.uid);
          window.dispatchEvent(new CustomEvent(DAY_SAVED_EVENT));
        } else {
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

  const dirty = !checksEqual(checks, savedChecks);

  const toggle = useCallback((id: HabitId) => {
    const snapshot = latest.current;
    if (!snapshot.uid || statusRef.current === "loading") return;
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
      if (!snapshot.uid || statusRef.current === "submitting") return;
      setStatus("submitting");
      setError(null);
      try {
        const outcome = await recordDay({
          date: snapshot.day,
          checks: { ...snapshot.checks },
          auto: false,
        });
        setSavedChecks({ ...snapshot.checks });
        setSubmitted({
          points: outcome.points,
          auto: false,
          updated: outcome.updated,
        });
        setStatus("saved");
        setNotice(null);
        window.dispatchEvent(new CustomEvent(DAY_SAVED_EVENT));
      } catch (cause) {
        setError(friendlyDbError(cause));
        setStatus(savedChecksRef.current ? "saved" : "ready");
      }
    })();
  }, [recordDay]);

  return {
    day,
    checks,
    points: pointsFor(checks),
    status,
    submitted,
    dirty,
    notice,
    error,
    toggle,
    submit,
  };
}
