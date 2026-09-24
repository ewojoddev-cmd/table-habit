"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import {
  HABITS,
  emptyCounts,
  identifyMember,
  normalizeChecks,
  normalizeCounts,
  parseDateKey,
  pointsFor,
  weekStartKey,
  type HabitChecks,
  type HabitCounts,
} from "@/lib/habits";

/**
 * Firestore shape for TableHabit:
 *
 *   users/{uid}                lifetime totals + avatar identity (one per account)
 *   dailyLogs/{uid}_{date}     one immutable record per submitted day
 *   drafts/{uid}               the in-progress checklist for the current day
 *
 * Weekly numbers are never stored as counters — they are derived from the
 * dailyLogs of the current week, which is what makes the weekly leaderboard
 * reset on its own while lifetime totals keep growing.
 */

export const USERS = "users";
export const DAY_LOGS = "dailyLogs";
export const DRAFTS = "drafts";

let cachedDb: Firestore | null = null;

export function getFirebaseDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(getFirebaseApp());
  return cachedDb;
}

type FirestoreData = Record<string, unknown>;

/** Firestore error code -> something the user can act on. */
export function friendlyDbError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "permission-denied":
      return "Firestore refused the request. Check the security rules (firestore.rules).";
    case "unavailable":
      return "Can't reach Firestore right now. Check your connection and try again.";
    case "failed-precondition":
      return "Firestore needs an index for this query — check the browser console for the link.";
    case "unauthenticated":
      return "Your session expired. Please sign in again.";
    default:
      return "Something went wrong while talking to Firestore.";
  }
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const call = (value as { toMillis?: () => number }).toMillis;
    if (typeof call === "function") return call.call(value);
  }
  return null;
}

export function dayLogId(uid: string, date: string): string {
  return `${uid}_${date}`;
}

export type DayLog = {
  id: string;
  uid: string;
  name: string;
  email: string;
  date: string;
  checks: HabitChecks;
  points: number;
  auto: boolean;
  submittedAt: number | null;
};

function mapDayLog(id: string, data: FirestoreData): DayLog {
  return {
    id,
    uid: String(data.uid ?? ""),
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    date: String(data.date ?? ""),
    checks: normalizeChecks(data.checks),
    points: Number(data.points ?? 0),
    auto: data.auto === true,
    submittedAt: toMillis(data.submittedAt),
  };
}

export type MemberStats = {
  uid: string;
  name: string;
  email: string;
  color: string;
  lifetimePoints: number;
  daysSubmitted: number;
  habitTotals: HabitCounts;
  lastSubmittedDate: string | null;
};

function mapMember(uid: string, data: FirestoreData): MemberStats {
  const identity = identifyMember(
    typeof data.email === "string" ? data.email : "",
  );
  return {
    uid,
    name:
      typeof data.name === "string" && data.name ? data.name : identity.name,
    email: identity.email,
    color:
      typeof data.color === "string" && data.color
        ? data.color
        : identity.color,
    lifetimePoints: Number(data.lifetimePoints ?? 0),
    daysSubmitted: Number(data.daysSubmitted ?? 0),
    habitTotals: normalizeCounts(data.habitTotals),
    lastSubmittedDate:
      typeof data.lastSubmittedDate === "string"
        ? data.lastSubmittedDate
        : null,
  };
}

/** Create the profile document on first sign-in; leave existing ones alone. */
export async function ensureProfile(user: {
  uid: string;
  email: string | null;
}): Promise<MemberStats> {
  const db = getFirebaseDb();
  const ref = doc(db, USERS, user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    return mapMember(user.uid, snapshot.data() as FirestoreData);
  }

  const identity = identifyMember(user.email);
  await setDoc(ref, {
    uid: user.uid,
    email: identity.email,
    name: identity.name,
    color: identity.color,
    lifetimePoints: 0,
    daysSubmitted: 0,
    habitTotals: emptyCounts(),
    lastSubmittedDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    uid: user.uid,
    name: identity.name,
    email: identity.email,
    color: identity.color,
    lifetimePoints: 0,
    daysSubmitted: 0,
    habitTotals: emptyCounts(),
    lastSubmittedDate: null,
  };
}

/* ------------------------------------------------------------------ drafts */

/** The submitted record for one day, if that day was already recorded. */
export async function loadDayLog(
  uid: string,
  date: string,
): Promise<DayLog | null> {
  const snapshot = await getDoc(
    doc(getFirebaseDb(), DAY_LOGS, dayLogId(uid, date)),
  );
  return snapshot.exists()
    ? mapDayLog(snapshot.id, snapshot.data() as FirestoreData)
    : null;
}

export type Draft = {
  date: string;
  checks: HabitChecks;
  updatedAt: number | null;
};

/** The checklist the user is filling in today (mirrored to Firestore). */
export async function loadDraft(uid: string): Promise<Draft | null> {
  const snapshot = await getDoc(doc(getFirebaseDb(), DRAFTS, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as FirestoreData;
  return {
    date: String(data.date ?? ""),
    checks: normalizeChecks(data.checks),
    updatedAt: toMillis(data.updatedAt),
  };
}

export async function saveDraft(
  uid: string,
  date: string,
  checks: HabitChecks,
): Promise<void> {
  await setDoc(
    doc(getFirebaseDb(), DRAFTS, uid),
    { uid, date, checks, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function clearDraft(uid: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), DRAFTS, uid));
}

/* ---------------------------------------------------------------- submitting */

export type SubmitOutcome = {
  /** Points recorded for the day. */
  points: number;
  /** True when Firestore already had this day, so nothing was added. */
  alreadySubmitted: boolean;
};

/**
 * Record one day for one user. Runs in a transaction so a day can only ever be
 * counted once, and the same transaction adds the points to the lifetime
 * totals plus the per-habit breakdown on the profile document.
 */
export async function submitDay(input: {
  uid: string;
  email: string;
  name: string;
  date: string;
  checks: HabitChecks;
  /** True when the clock ran out and the day was closed automatically. */
  auto: boolean;
}): Promise<SubmitOutcome> {
  const db = getFirebaseDb();
  const identity = identifyMember(input.email);
  const points = pointsFor(input.checks);

  return runTransaction(db, async (transaction) => {
    const logRef = doc(db, DAY_LOGS, dayLogId(input.uid, input.date));
    const logSnapshot = await transaction.get(logRef);
    if (logSnapshot.exists()) {
      return {
        points: Number((logSnapshot.data() as FirestoreData).points ?? 0),
        alreadySubmitted: true,
      };
    }

    const profileRef = doc(db, USERS, input.uid);
    const profileSnapshot = await transaction.get(profileRef);
    const profile = profileSnapshot.exists()
      ? (profileSnapshot.data() as FirestoreData)
      : {};

    const habitTotals = normalizeCounts(profile.habitTotals);
    for (const habit of HABITS) {
      if (input.checks[habit.id]) habitTotals[habit.id] += 1;
    }

    transaction.set(logRef, {
      uid: input.uid,
      name: input.name || identity.name,
      email: identity.email,
      date: input.date,
      weekStart: weekStartKey(parseDateKey(input.date)),
      checks: input.checks,
      points,
      auto: input.auto,
      submittedAt: serverTimestamp(),
    });

    transaction.set(
      profileRef,
      {
        uid: input.uid,
        email: identity.email,
        name:
          (typeof profile.name === "string" && profile.name) ||
          input.name ||
          identity.name,
        color:
          (typeof profile.color === "string" && profile.color) ||
          identity.color,
        lifetimePoints: Number(profile.lifetimePoints ?? 0) + points,
        daysSubmitted: Number(profile.daysSubmitted ?? 0) + 1,
        habitTotals,
        lastSubmittedDate: input.date,
        createdAt: profileSnapshot.exists()
          ? (profile.createdAt ?? serverTimestamp())
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { points, alreadySubmitted: false };
  });
}

/* ------------------------------------------------------------------ reads */

/**
 * Every day log from `since` onwards (all users). This is what powers the
 * weekly table and the weekly leaderboard.
 */
export async function fetchLogsSince(since: string): Promise<DayLog[]> {
  const logs = query(
    collection(getFirebaseDb(), DAY_LOGS),
    where("date", ">=", since),
  );
  const snapshot = await getDocs(logs);
  return snapshot.docs.map((entry) =>
    mapDayLog(entry.id, entry.data() as FirestoreData),
  );
}

/** All profile documents — lifetime totals and avatar identities. */
export async function fetchMembers(): Promise<MemberStats[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), USERS));
  return snapshot.docs.map((entry) =>
    mapMember(entry.id, entry.data() as FirestoreData),
  );
}

