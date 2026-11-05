"use client";

import { useEffect, useState } from "react";

/**
 * Counts down to a server-configured instant. `serverTime` corrects for a
 * wrong device clock; the deadline itself always comes from the server.
 */
export function Countdown({ to, serverTime, label, onDone, className }: { to: string; serverTime: string; label?: string; onDone?: () => void; className?: string }) {
  const [offset] = useState(() => Date.parse(serverTime) - Date.now());
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [offset]);
  const remaining = now == null ? null : Math.max(0, Date.parse(to) - now);
  useEffect(() => {
    if (remaining === 0) onDone?.();
  }, [remaining, onDone]);
  const parts = remaining == null ? null : [Math.floor(remaining / 86_400_000), Math.floor(remaining / 3_600_000) % 24, Math.floor(remaining / 60_000) % 60, Math.floor(remaining / 1000) % 60];
  const units = ["days", "hours", "minutes", "seconds"];
  return (
    <div className={className} role="timer" aria-label={label}>
      <dl className="flex gap-6 md:gap-10">
        {units.map((u, i) => (
          <div key={u} className="min-w-[3.2rem]">
            <dd className="serif tabular text-[2.4rem] font-light leading-none md:text-[3.2rem]">{parts ? String(parts[i]).padStart(2, "0") : "––"}</dd>
            <dt className="eyebrow mt-2 !text-current opacity-70">{u}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
