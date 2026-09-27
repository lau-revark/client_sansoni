import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Aaron Sansoni Group</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Sign in to Sales</h1>
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </main>
  );
}
