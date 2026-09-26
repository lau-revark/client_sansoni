import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/records", label: "Records" },
    ...(user.role === "admin" ? [{ href: "/admin/events", label: "Events & QR codes" }] : []),
  ];
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold">AS</span>
            <span>Aaron Sansoni Group</span>
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-white/80 hover:bg-navy-2 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{user.name}</span>
            <form action={logout}>
              <button className="rounded-md border border-white/20 px-3 py-1.5 text-white/90 hover:bg-navy-2">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

export function Card({ title, children, actions, className = "" }: { title?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
      {children}
      {actions && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">{actions}</div>}
    </section>
  );
}

export function Pagination({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const btn = "rounded-lg border border-line px-4 py-2 text-sm";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {total.toLocaleString("en-AU")} records · Page {Math.min(page, pages)} of {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? <Link className={`${btn} text-ink hover:bg-canvas`} href={hrefFor(page - 1)}>Previous</Link> : <span className={`${btn} text-muted/60`}>Previous</span>}
        {page < pages ? <Link className={`${btn} text-ink hover:bg-canvas`} href={hrefFor(page + 1)}>Next</Link> : <span className={`${btn} text-muted/60`}>Next</span>}
      </div>
    </div>
  );
}
