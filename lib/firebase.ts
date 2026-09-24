"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  // Keep the session across reloads/tabs.
  void setPersistence(auth, browserLocalPersistence).catch(() => {});
  return auth;
}

/** Analytics is optional and only loaded in the browser. */
export async function initAnalytics(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(getFirebaseApp());
  } catch {
    // Analytics failures must never block the app.
  }
}
