"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RANGE_PRESETS } from "@/lib/dates";

const REFRESH_MS = 30_000;
const PAUSE_KEY = "asg:live-paused";

export function FilterBar({ events, cities = [] }: { events: { id: string; name: string; city: string }[]; cities?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [paused, setPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const range = params.get("range") ?? "all";

  useEffect(() => {
    try {
      setPaused(localStorage.getItem(PAUSE_KEY) === "1");
    } catch {}
    setUpdatedAt(new Date());
  }, []);

  const refresh = () =>
    startTransition(() => {
      router.refresh();
      setUpdatedAt(new Date());
    });

  useEffect(() => {
    if (paused) return;
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const togglePause = () => {
    setPaused((p) => {
      try {
        localStorage.setItem(PAUSE_KEY, p ? "0" : "1");
      } catch {}
      return !p;
    });
  };

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const control = "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <label className="sr-only" htmlFor="range">Date range</label>
      <select id="range" className={control} value={range} onChange={(e) => update({ range: e.target.value, from: null, to: null })}>
        {RANGE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      {range === "custom" && (
        <div className="flex items-center gap-2">
          <input aria-label="From" type="date" className={control} defaultValue={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value })} />
          <span className="text-muted">–</span>
          <input aria-label="To" type="date" className={control} defaultValue={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value })} />
        </div>
      )}

      {cities.length > 1 && (
        <>
          <label className="sr-only" htmlFor="city">City</label>
          <select id="city" className={control} value={params.get("city") ?? ""} onChange={(e) => update({ city: e.target.value || null })}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </>
      )}

      <label className="sr-only" htmlFor="event">Event</label>
      <select id="event" className={control} value={params.get("event") ?? ""} onChange={(e) => update({ event: e.target.value || null })}>
        <option value="">All events</option>
        {events.filter((ev) => !params.get("city") || ev.city === params.get("city")).map((ev) => (
          <option key={ev.id} value={ev.id}>{ev.name} · {ev.city}</option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-3 text-sm text-ink-2">
        <span className="flex items-center gap-1.5" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-muted" : "animate-pulse bg-accent"}`} />
          {paused ? "Paused" : "Live"}
          {updatedAt && <span className="hidden text-muted sm:inline">· {updatedAt.toLocaleTimeString("en-AU")}</span>}
        </span>
        <button onClick={togglePause} className="rounded-md border border-line px-2.5 py-1.5 hover:bg-canvas" aria-label={paused ? "Resume live updates" : "Pause live updates"}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button onClick={refresh} disabled={pending} className="rounded-md border border-line px-2.5 py-1.5 hover:bg-canvas disabled:opacity-60" aria-label="Refresh now">
          {pending ? "…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}
