import type { FirebaseOptions } from "firebase/app";

/**
 * TableHabit Firebase web app configuration.
 *
 * The values come from the environment — `.env.local` in development, repository
 * secrets in the GitHub Pages workflow — so no project identifiers are committed.
 * Read each one through a literal `process.env.NEXT_PUBLIC_...` lookup: Next.js
 * only inlines statically analysable names into the browser bundle.
 *
 * A Firebase web config is an *identifier*, not a secret (it is reachable in any
 * shipped bundle), so the app's real protection is `firestore.rules`, the Google
 * Cloud API-key restrictions and the Auth sign-up setting.
 */
const missing: string[] = [];

function required(name: string, value: string | undefined): string {
  if (value) return value;
  missing.push(name);
  return "";
}

export const firebaseConfig: FirebaseOptions = {
  apiKey: required(
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  ),
  authDomain: required(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: required(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  ),
  storageBucket: required(
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ),
  messagingSenderId: required(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: required(
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

if (missing.length) {
  throw new Error(
    `Missing Firebase web config: ${missing.join(", ")}. Copy .env.example to ` +
      ".env.local and fill it in — the Pages build reads the same names from " +
      "GitHub Actions secrets.",
  );
}
