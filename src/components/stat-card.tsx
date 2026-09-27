import Link from "next/link";

export function StatCard({
  label,
  value,
  hint,
  recordsHref,
  csvHref,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  recordsHref?: string;
  csvHref?: string;
  emphasis?: boolean;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-medium text-ink-2">{label}</h3>
      <p className={`tabular mt-3 font-bold tracking-tight text-ink ${emphasis ? "text-3xl sm:text-4xl" : "text-3xl"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {(recordsHref || csvHref) && (
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-sm text-ink-2">
          {recordsHref && <Link className="hover:text-accent hover:underline" href={recordsHref}>View underlying records</Link>}
          {csvHref && <a className="hover:text-accent hover:underline" href={csvHref}>Export CSV</a>}
        </div>
      )}
    </section>
  );
}
