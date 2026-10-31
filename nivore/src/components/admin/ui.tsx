import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="display mt-1 text-[2.2rem]">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-[13.5px] text-taupe-ink">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("border border-line bg-ivory p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="eyebrow">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, href }: { label: string; value: ReactNode; note?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-2 text-[1.6rem] leading-none">{value}</p>
      {note && <p className="mt-2 text-[12px] text-taupe-ink">{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block border border-line bg-ivory p-5 transition-colors hover:border-line-strong">{body}</Link>
  ) : (
    <div className="border border-line bg-ivory p-5">{body}</div>
  );
}

const TONES: Record<string, string> = {
  ok: "bg-[#e3ebe4] text-ok",
  warn: "bg-[#f1e7d2] text-warn",
  err: "bg-[#f1dcd7] text-err",
  muted: "bg-cream text-taupe-ink",
  ink: "bg-espresso text-ivory",
};

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cn("inline-block whitespace-nowrap px-2 py-0.5 text-[11px] tracking-[0.04em]", TONES[tone])}>{children}</span>;
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="bg-cream">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-2.5 text-[11px] font-normal uppercase tracking-[0.12em] text-taupe-ink">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="hidden p-6 text-center text-taupe-ink only:block">{empty}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-line p-8 text-center text-[13.5px] text-taupe-ink">{children}</p>;
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(iso)) : "—";
