"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, initAnalytics } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  /** True until the first auth state resolution completes. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  /** Emails Firebase's default "reset your password" link to the address. */
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Firebase error codes -> friendly, minimal copy. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again in a moment.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Could not sign you in. Please try again.";
  }
}

/**
 * Firebase error codes -> friendly, minimal copy for a password reset request.
 * (Deliberately separate from authErrorMessage: a reset for an unknown address
 * is not a bad password, and `auth/user-not-found` may instead come back as a
 * silent success when email enumeration protection is on.)
 */
export function passwordResetErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/missing-email":
      return "Enter your email address, then try again.";
    case "auth/user-not-found":
      return "No TableHabit account uses that email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again in a moment.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Could not send the reset email. Please try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void initAnalytics();
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        const credential = await signInWithEmailAndPassword(
          getFirebaseAuth(),
          email.trim(),
          password,
        );
        return credential.user;
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      },
      async signOut() {
        await firebaseSignOut(getFirebaseAuth());
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
