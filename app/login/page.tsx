"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthProvider, authErrorMessage, passwordResetErrorMessage, useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}

function LoginForm() {
  const { user, loading, signIn, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (signInError) {
      setError(authErrorMessage(signInError));
      setSubmitting(false);
    }
  }

  /**
   * Sends Firebase's default password-reset email to the address typed in the
   * form above. Nothing else changes: the reset itself happens on Firebase's
   * hosted page, so the template stays the stock one.
   */
  async function handleReset() {
    setResetError(null);
    setResetSentTo(null);

    const target = email.trim();
    if (!target) {
      setResetError("Enter your email above, then tap reset.");
      return;
    }

    setResetting(true);
    try {
      await resetPassword(target);
      setResetSentTo(target);
    } catch (resetFailure) {
      setResetError(passwordResetErrorMessage(resetFailure));
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="th-backdrop grid min-h-screen place-items-center px-6 py-16">
      <section className="w-full max-w-sm rounded-3xl border border-th-haze bg-white/85 px-8 py-10 shadow-[0_24px_60px_-30px_rgba(0,31,77,0.45)] backdrop-blur">
        <div className="flex justify-center">
          <Logo size={44} withWordmark={false} />
        </div>

        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-th-prussian">
          Log in to TableHabit
        </h1>
        <p className="mt-2 text-center text-sm text-th-orient/80">
          Sign in with your email and password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-th-regal"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-th-haze bg-th-mist px-4 py-3 text-sm text-th-prussian placeholder:text-th-orient/40 focus:border-th-mariner focus:bg-white focus:outline-none focus:ring-2 focus:ring-th-sky"
              placeholder="Your login email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-th-regal"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-th-haze bg-th-mist px-4 py-3 text-sm text-th-prussian placeholder:text-th-orient/40 focus:border-th-mariner focus:bg-white focus:outline-none focus:ring-2 focus:ring-th-sky"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-th-cerulean bg-white px-4 py-3 text-sm font-medium text-th-regal"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-th-mariner px-6 py-3 text-base font-medium text-white transition-colors hover:bg-th-cerulean focus:outline-none focus-visible:ring-2 focus-visible:ring-th-cerulean focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Login"}
          </button>

          <div className="pt-1 text-center text-sm">
            <button
              id="reset-password"
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="rounded font-medium text-th-cerulean underline-offset-4 transition-colors hover:text-th-regal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-th-sky disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resetting ? "Sending reset link…" : "Reset your password"}
            </button>
            <p className="mt-1 text-xs text-th-orient/60">
              We&apos;ll email you Firebase&apos;s reset link.
            </p>
          </div>
        </form>

        {resetSentTo ? (
          <p
            id="reset-sent"
            role="status"
            className="mt-6 rounded-xl border border-th-sky bg-th-mist px-4 py-3 text-sm text-th-regal"
          >
            Reset link sent to <span className="font-medium">{resetSentTo}</span>
            . Open the email and choose a new password, then log in here.
          </p>
        ) : null}

        {resetError ? (
          <p
            id="reset-error"
            role="alert"
            className="mt-6 rounded-xl border border-th-cerulean bg-white px-4 py-3 text-sm font-medium text-th-regal"
          >
            {resetError}
          </p>
        ) : null}

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-th-orient/80 underline-offset-4 transition-colors hover:text-th-cerulean hover:underline"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}
