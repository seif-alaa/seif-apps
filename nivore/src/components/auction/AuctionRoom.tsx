"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatEGP } from "@/domain/money";
import { Countdown } from "./Countdown";

interface Live {
  status: string;
  mode: "demonstration" | "live";
  currentBidMinor: number;
  bidCount: number;
  minimumNextMinor: number;
  opensAt: string;
  closesAt: string;
  version: number;
  serverTime: string;
  recent: { label: string; amountMinor: number; at: string; demonstration: boolean }[];
}

const STATUS: Record<string, string> = { upcoming: "Upcoming", open: "Open for bidding", closed: "Closed", pending_payment: "Pending payment", sold: "Sold", unsold: "Unsold", cancelled: "Cancelled" };

export function AuctionRoom({ id, initial, incrementMinor, biddingOpen }: { id: string; initial: Live; incrementMinor: number; biddingOpen: boolean }) {
  const [live, setLive] = useState<Live>(initial);
  const [amount, setAmount] = useState(String(initial.minimumNextMinor / 100));
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/auctions/${id}`, { cache: "no-store" });
    if (res.ok) setLive(await res.json());
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function bid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pounds = Number(amount);
    if (!Number.isInteger(pounds) || pounds * 100 < live.minimumNextMinor) {
      setMsg({ kind: "err", text: `Enter at least ${formatEGP(live.minimumNextMinor)}, in whole pounds.` });
      return;
    }
    key.current ||= crypto.randomUUID();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/auctions/${id}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor: pounds * 100, idempotencyKey: key.current, expectedVersion: live.version, acceptTerms: fd.get("terms") === "on", bidder: { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") } }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    key.current = "";
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error ?? "Your bid could not be placed." });
      if (data.minimumNextMinor) setAmount(String(data.minimumNextMinor / 100));
      refresh();
      return;
    }
    setMsg({ kind: "ok", text: data.demonstration ? `Demonstration bid recorded as ${data.label}. It is not binding.` : `Your bid is recorded as ${data.label}.` });
    setAmount(String(data.auction.minimumNextMinor / 100));
    refresh();
  }

  const open = live.status === "open";
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow border border-current px-2.5 py-1 !text-espresso">{STATUS[live.status] ?? live.status}</span>
        {live.mode === "demonstration" && <span className="eyebrow bg-cream px-2.5 py-1">Demonstration room</span>}
      </div>

      {(live.status === "upcoming" || open) && (
        <div>
          <p className="eyebrow mb-3">{live.status === "upcoming" ? "Opens in" : "Closes in"}</p>
          <Countdown to={live.status === "upcoming" ? live.opensAt : live.closesAt} serverTime={live.serverTime} onDone={refresh} label={live.status === "upcoming" ? "Time until bidding opens" : "Time until bidding closes"} />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-6 border-y border-line py-6 sm:grid-cols-3">
        <div>
          <dt className="eyebrow">{live.bidCount ? "Highest bid" : "Starting bid"}</dt>
          <dd className="tabular mt-1 text-[1.3rem]" data-testid="current-bid">{formatEGP(live.bidCount ? live.currentBidMinor : live.minimumNextMinor)}</dd>
        </div>
        <div>
          <dt className="eyebrow">Minimum next bid</dt>
          <dd className="tabular mt-1 text-[1.3rem]">{formatEGP(live.minimumNextMinor)}</dd>
        </div>
        <div>
          <dt className="eyebrow">Bids</dt>
          <dd className="tabular mt-1 text-[1.3rem]">{live.bidCount}</dd>
        </div>
      </dl>

      {open && biddingOpen ? (
        <form onSubmit={bid} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="field-label">Full name</span><input name="name" className="field" autoComplete="name" required /></label>
            <label className="block"><span className="field-label">Email</span><input name="email" type="email" className="field" autoComplete="email" required /></label>
            <label className="block"><span className="field-label">Mobile</span><input name="phone" type="tel" className="field" autoComplete="tel" required /></label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="field-label">Your bid (EGP, increments of {formatEGP(incrementMinor)})</span>
              <input className="field tabular" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} data-testid="bid-amount" />
            </label>
            <button className="btn btn-primary" disabled={busy} data-testid="place-bid">{busy ? "Placing…" : live.mode === "demonstration" ? "Place demonstration bid" : "Place bid"}</button>
          </div>
          <label className="flex gap-3 text-[13px] text-taupe-ink">
            <input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 accent-[var(--color-espresso)]" />
            <span>I have read the auction terms. {live.mode === "demonstration" ? "I understand this is a demonstration and my bid is not binding." : "My bid is a binding offer."}</span>
          </label>
          {msg && <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "field-error" : "text-[13px] text-ok"}>{msg.text}</p>}
        </form>
      ) : open && !biddingOpen ? (
        <p className="text-[14px] text-taupe-ink">Bidding is paused at the moment.</p>
      ) : null}

      {live.recent.length > 0 && (
        <div>
          <h3 className="eyebrow">Bid history</h3>
          <ul className="mt-3 divide-y divide-line text-[13.5px]">
            {live.recent.map((b, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>{b.label}{b.demonstration && <span className="text-taupe-ink"> · demonstration</span>}</span>
                <span className="tabular">{formatEGP(b.amountMinor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
