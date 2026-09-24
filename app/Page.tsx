import Link from "next/link";
import Logo from "@/components/Logo";

export default function LandingPage() {
  return (
    <main className="th-backdrop grid min-h-screen place-items-center px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-th-haze bg-white/80 px-10 py-14 text-center shadow-[0_24px_60px_-30px_rgba(0,31,77,0.45)] backdrop-blur">
        <div className="flex justify-center">
          <Logo size={84} withWordmark={false} />
        </div>

        <h1 className="mt-7 text-4xl font-semibold tracking-tight text-th-prussian">
          TableHabit
        </h1>

        <p className="mt-3 text-base text-th-orient">
          Group in a table, Build a habit
        </p>

        <Link
          href="/login"
          className="mt-10 inline-flex w-full items-center justify-center rounded-xl bg-th-mariner px-6 py-3 text-base font-medium text-white transition-colors hover:bg-th-cerulean focus:outline-none focus-visible:ring-2 focus-visible:ring-th-cerulean focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Login
        </Link>
      </section>
    </main>
  );
}
