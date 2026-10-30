import { describe, expect, it } from "vitest";
import { products, seedAuctions } from "@/data/seed/catalog-seed";
import { compat, components, movementFamilies } from "@/data/seed/components";
import { applyBid, auctionStatus, minimumNextBid, settleAuction, validateBid, type Auction, type Bid } from "@/domain/auction";
import { toPublicCatalog } from "@/domain/catalog";
import { createEngine } from "@/domain/compatibility";
import { decodeConfiguration } from "@/domain/configuration";
import { normalizeEgyptianMobile, normalizePhone } from "@/domain/egypt";
import { cairoLocalToUtc, resolveStorefront, utcToCairoLocal } from "@/domain/storefront";

const now = new Date("2026-11-01T10:00:00Z");
const base = (): Auction => ({ ...seedAuctions(now)[0], published: true });
const ctx = (over: Partial<Parameters<typeof validateBid>[2]> = {}) => ({ now, recentBidsByBidder: 0, maxBidsPerWindow: 5, seenIdempotencyKeys: new Set<string>(), ...over });
const attempt = (amountMinor: number, over = {}) => ({ bidderId: "b1", bidderVerified: true, bidderIsOwner: false, amountMinor, idempotencyKey: `k${amountMinor}`, ...over });

describe("auction rules", () => {
  it("derives status from server time", () => {
    const a = base();
    expect(auctionStatus(a, new Date(Date.parse(a.opensAt) - 1))).toBe("upcoming");
    expect(auctionStatus(a, now)).toBe("open");
    expect(auctionStatus(a, new Date(Date.parse(a.closesAt) + 1))).toBe("closed");
    expect(auctionStatus({ ...a, adminStatus: "cancelled" }, now)).toBe("cancelled");
  });

  it("enforces the starting bid, then the increment", () => {
    let a = base();
    expect(validateBid(a, attempt(a.startingBidMinor - 100), ctx())).toBe("too_low");
    expect(validateBid(a, attempt(a.startingBidMinor), ctx())).toBeNull();
    a = applyBid(a, attempt(a.startingBidMinor), now);
    expect(minimumNextBid(a)).toBe(a.startingBidMinor + a.incrementMinor);
    expect(validateBid(a, attempt(a.currentBidMinor + 100, { bidderId: "b2" }), ctx())).toBe("too_low");
    expect(validateBid(a, attempt(minimumNextBid(a), { bidderId: "b2" }), ctx())).toBeNull();
  });

  it("refuses owners, unverified bidders, duplicates, self-outbidding, stale versions and floods", () => {
    const a = applyBid(base(), attempt(base().startingBidMinor), now);
    const next = minimumNextBid(a);
    expect(validateBid(a, attempt(next, { bidderId: "x", bidderIsOwner: true }), ctx())).toBe("owner_bid");
    expect(validateBid(a, attempt(next, { bidderId: "x", bidderVerified: false }), ctx())).toBe("unverified_bidder");
    expect(validateBid(a, attempt(next, { bidderId: "x" }), ctx({ seenIdempotencyKeys: new Set([`k${next}`]) }))).toBe("duplicate");
    expect(validateBid(a, attempt(next), ctx())).toBe("already_leading");
    expect(validateBid(a, attempt(next, { bidderId: "x", expectedVersion: a.version - 1 }), ctx())).toBe("stale_version");
    expect(validateBid(a, attempt(next, { bidderId: "x" }), ctx({ recentBidsByBidder: 5 }))).toBe("rate_limited");
    expect(validateBid(a, attempt(next + 50, { bidderId: "x" }), ctx())).toBe("not_whole_pounds");
    expect(validateBid({ ...a, published: false }, attempt(next, { bidderId: "x" }), ctx())).toBe("not_open");
  });

  it("extends the close time for late bids (anti-sniping)", () => {
    const a = base();
    const late = new Date(Date.parse(a.closesAt) - 2 * 60_000);
    const after = applyBid(a, attempt(a.startingBidMinor), late);
    expect(Date.parse(after.closesAt) - Date.parse(a.closesAt)).toBe(5 * 60_000);
    const early = applyBid(a, attempt(a.startingBidMinor), now);
    expect(early.closesAt).toBe(a.closesAt);
  });

  it("settles to the highest real bid, ignoring demonstration bids and honouring the reserve", () => {
    const a = { ...base(), reserveMinor: 1_600_000 };
    const closed = new Date(Date.parse(a.closesAt) + 1000);
    const bid = (id: string, amount: number, demonstration = false): Bid => ({ id, auctionId: a.id, bidderId: id, bidderLabel: id, amountMinor: amount, placedAt: now.toISOString(), idempotencyKey: id, demonstration, status: "accepted" });
    expect(settleAuction(a, [bid("a", 1_500_000)], closed).adminStatus).toBe("unsold");
    const won = settleAuction(a, [bid("a", 1_500_000), bid("b", 1_700_000), bid("demo", 9_000_000, true)], closed);
    expect(won.adminStatus).toBe("pending_payment");
    expect(won.winner?.bidderId).toBe("b");
    expect(settleAuction(a, [], now)).toBe(a); // not closed yet
  });
});

describe("storefront modes", () => {
  const s = { mode: "live" as const, launchAt: null, countdownVisible: true, checkoutLocked: false, biddingLocked: false };
  it("resolves each mode on the server", () => {
    expect(resolveStorefront(s, now)).toMatchObject({ gate: "none", checkoutOpen: true, biddingOpen: true });
    expect(resolveStorefront({ ...s, mode: "maintenance" }, now).gate).toBe("maintenance");
    expect(resolveStorefront({ ...s, mode: "password" }, now).gate).toBe("password");
    expect(resolveStorefront({ ...s, mode: "password" }, now, { hasAccessPass: true }).gate).toBe("none");
    expect(resolveStorefront({ ...s, mode: "browse_only" }, now)).toMatchObject({ gate: "none", checkoutOpen: false, biddingOpen: false });
    expect(resolveStorefront({ ...s, checkoutLocked: true }, now)).toMatchObject({ checkoutOpen: false, biddingOpen: true });
  });

  it("opens a scheduled launch exactly at the configured time and never without one", () => {
    const launchAt = "2026-11-01T12:00:00Z";
    expect(resolveStorefront({ ...s, mode: "scheduled", launchAt }, now)).toMatchObject({ gate: "coming_soon", countdownTo: launchAt });
    expect(resolveStorefront({ ...s, mode: "scheduled", launchAt }, new Date(launchAt)).gate).toBe("none");
    expect(resolveStorefront({ ...s, mode: "scheduled", launchAt: null }, now).gate).toBe("coming_soon");
    expect(resolveStorefront({ ...s, mode: "coming_soon", launchAt, countdownVisible: false }, now).countdownTo).toBeNull();
  });

  it("converts Cairo wall-clock time, including daylight saving", () => {
    expect(cairoLocalToUtc("2026-01-15T20:00")).toBe("2026-01-15T18:00:00.000Z"); // UTC+2 in winter
    expect(cairoLocalToUtc("2026-07-15T20:00")).toBe("2026-07-15T17:00:00.000Z"); // UTC+3 in summer
    expect(utcToCairoLocal("2026-07-15T17:00:00.000Z")).toBe("2026-07-15T20:00");
  });
});

describe("Egyptian phone numbers", () => {
  it("normalises local and international forms", () => {
    expect(normalizeEgyptianMobile("010 1234 5678")).toBe("+201012345678");
    expect(normalizeEgyptianMobile("+20 11 1234 5678")).toBe("+201112345678");
    expect(normalizeEgyptianMobile("00201512345678")).toBe("+201512345678");
    expect(normalizeEgyptianMobile("0131234567")).toBeNull();
    expect(normalizePhone("+44 7700 900123", { allowInternational: false })).toBeNull();
    expect(normalizePhone("+44 7700 900123", { allowInternational: true })).toBe("+447700900123");
  });
});

describe("seed integrity", () => {
  const engine = createEngine(toPublicCatalog({ movementFamilies, components, compat, assets: [] }));
  it("every product is a valid composition", () => {
    for (const p of products) expect(engine.validate(p.configuration), p.id).toMatchObject({ issues: [], missing: [] });
  });
  it("auction preview builds decode to compatible compositions", () => {
    for (const a of seedAuctions(now)) {
      const cfg = decodeConfiguration(new URLSearchParams(a.previewBuild!), toPublicCatalog({ movementFamilies, components, compat, assets: [] }).components)!;
      expect(engine.validate(cfg).issues, a.id).toEqual([]);
    }
  });
});
