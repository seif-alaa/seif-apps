import "server-only";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { applyBid, settleAuction, validateBid, type Auction, type Bid } from "@/domain/auction";
import type { Catalog } from "@/domain/catalog";
import type { AuditEntry, BidderProfile, Collection, Customer, Inquiry, Order, Product, WaitlistEntry } from "@/domain/models";
import type { Content, Settings } from "@/domain/settings";
import { collections, content, products, seedAuctions, settings } from "../seed/catalog-seed";
import { compat, components, movementFamilies } from "../seed/components";
import type { Actor, Repositories } from "./types";

/**
 * DEVELOPMENT-ONLY persistence: a single JSON file in `.data/`.
 *
 * It exists so the storefront, builder and admin can be exercised end to end
 * locally. It is NOT a production backend: no multi-instance safety, no
 * backups, no access control beyond the admin session, and serverless hosts
 * discard local files. Real orders, payments and bidding require the durable
 * driver described in docs/PRODUCTION.md.
 */

interface DevDb {
  schema: 1;
  createdAt: string;
  catalog: Catalog;
  products: Product[];
  collections: Collection[];
  orders: Order[];
  orderKeys: Record<string, string>;
  customers: Customer[];
  auctions: Auction[];
  bids: Bid[];
  bidders: BidderProfile[];
  settings: Settings;
  content: Content;
  inquiries: Inquiry[];
  waitlist: WaitlistEntry[];
  audit: AuditEntry[];
  counters: { order: number; bidder: number };
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "dev-db.json");

function seed(): DevDb {
  const now = new Date();
  return {
    schema: 1,
    createdAt: now.toISOString(),
    catalog: { movementFamilies, components, compat, assets: [] },
    products,
    collections,
    orders: [],
    orderKeys: {},
    customers: [],
    auctions: seedAuctions(now),
    bids: [],
    bidders: [],
    settings,
    content,
    inquiries: [],
    waitlist: [],
    audit: [],
    counters: { order: 0, bidder: 0 },
  };
}

let cache: { mtimeMs: number; db: DevDb } | null = null;

function load(): DevDb {
  if (!existsSync(DB_FILE)) {
    mkdirSync(DATA_DIR, { recursive: true });
    const db = seed();
    write(db);
    return db;
  }
  const { mtimeMs } = statSync(DB_FILE);
  if (cache && cache.mtimeMs === mtimeMs) return cache.db;
  const db = JSON.parse(readFileSync(DB_FILE, "utf8")) as DevDb;
  cache = { mtimeMs, db };
  return db;
}

function write(db: DevDb) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, DB_FILE);
  cache = { mtimeMs: statSync(DB_FILE).mtimeMs, db };
}

/* Writes are serialised through one promise chain (single-process only). */
let queue: Promise<unknown> = Promise.resolve();
function transact<T>(fn: (db: DevDb) => T): Promise<T> {
  const run = queue.then(() => {
    const db = structuredClone(load());
    const result = fn(db);
    write(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

const read = async <T>(fn: (db: DevDb) => T): Promise<T> => structuredClone(fn(load()));
const nowIso = () => new Date().toISOString();

function audit(db: DevDb, actor: Actor, action: string, entity: string, entityId: string, summary: string, before?: unknown, after?: unknown) {
  db.audit.unshift({ id: randomUUID(), at: nowIso(), actor: actor.label, action, entity, entityId, summary, before, after });
  if (db.audit.length > 2000) db.audit.length = 2000;
}

function orderRef(n: number, at: Date): string {
  const y = String(at.getUTCFullYear()).slice(2);
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `NV${y}${m}-${String(n).padStart(4, "0")}`;
}

function mustOrder(db: DevDb, ref: string): Order {
  const o = db.orders.find((x) => x.ref === ref);
  if (!o) throw new Error(`Order ${ref} not found`);
  return o;
}

export const devRepositories: Repositories = {
  driver: "dev",

  catalog: {
    get: () => read((db) => db.catalog),
    upsertComponent: (component, actor) =>
      transact((db) => {
        const i = db.catalog.components.findIndex((c) => c.id === component.id);
        const before = i >= 0 ? db.catalog.components[i] : undefined;
        const next = { ...component, updatedAt: nowIso() };
        if (i >= 0) db.catalog.components[i] = next;
        else db.catalog.components.push(next);
        const priceChanged = before && (before.priceMinor !== next.priceMinor || before.priceAdjustmentMinor !== next.priceAdjustmentMinor);
        audit(
          db,
          actor,
          before ? (priceChanged ? "price.change" : "component.update") : "component.create",
          "component",
          next.id,
          before ? `${next.name} updated${priceChanged ? ` (price ${before.priceMinor} → ${next.priceMinor})` : ""}` : `${next.name} created`,
          before ? { priceMinor: before.priceMinor, priceAdjustmentMinor: before.priceAdjustmentMinor, stock: before.stock, active: before.active } : undefined,
          { priceMinor: next.priceMinor, priceAdjustmentMinor: next.priceAdjustmentMinor, stock: next.stock, active: next.active },
        );
        return next;
      }),
    setComponentActive: (id, active, actor) =>
      transact((db) => {
        const c = db.catalog.components.find((x) => x.id === id);
        if (!c) throw new Error("Component not found");
        c.active = active;
        c.updatedAt = nowIso();
        audit(db, actor, active ? "component.activate" : "component.deactivate", "component", id, `${c.name} ${active ? "activated" : "deactivated"}`);
      }),
    upsertMovementFamily: (family, actor) =>
      transact((db) => {
        const i = db.catalog.movementFamilies.findIndex((f) => f.id === family.id);
        if (i >= 0) db.catalog.movementFamilies[i] = family;
        else db.catalog.movementFamilies.push(family);
        audit(db, actor, "movement-family.save", "movementFamily", family.id, `${family.name} saved`);
      }),
    upsertCompat: (record, actor) =>
      transact((db) => {
        const i = db.catalog.compat.findIndex((r) => r.id === record.id);
        const next = { ...record, updatedAt: nowIso() };
        if (i >= 0) db.catalog.compat[i] = next;
        else db.catalog.compat.push(next);
        audit(db, actor, "compat.save", "compat", record.id, `${record.aId} × ${record.bId}: ${record.status}`);
      }),
    deleteCompat: (id, actor) =>
      transact((db) => {
        db.catalog.compat = db.catalog.compat.filter((r) => r.id !== id);
        audit(db, actor, "compat.delete", "compat", id, "Compatibility record removed");
      }),
    upsertAsset: (asset, actor) =>
      transact((db) => {
        const i = db.catalog.assets.findIndex((a) => a.id === asset.id);
        const next = { ...asset, updatedAt: nowIso() };
        if (i >= 0) db.catalog.assets[i] = next;
        else db.catalog.assets.push(next);
        audit(db, actor, "asset.save", "asset", asset.id, `${asset.slot} asset for ${asset.componentId} (${asset.status})`);
      }),
    deleteAsset: (id, actor) =>
      transact((db) => {
        db.catalog.assets = db.catalog.assets.filter((a) => a.id !== id);
        audit(db, actor, "asset.delete", "asset", id, "Preview asset removed");
      }),
    adjustStock: (deltas, actor) =>
      transact((db) => {
        const ranOut: string[] = [];
        for (const { id, delta } of deltas) {
          const c = db.catalog.components.find((x) => x.id === id);
          if (!c || c.stock.quantity == null) continue;
          c.stock.quantity = Math.max(0, c.stock.quantity + delta);
          if (c.stock.quantity === 0 && c.stock.status !== "made_to_order") {
            c.stock.status = "out_of_stock";
            ranOut.push(id);
          } else if (c.stock.quantity <= 2 && c.stock.status === "in_stock") c.stock.status = "low";
        }
        if (deltas.length) audit(db, actor, "inventory.adjust", "component", "*", `Stock adjusted for ${deltas.length} components`);
        return ranOut;
      }),
  },

  products: {
    list: () => read((db) => [...db.products].sort((a, b) => a.sortOrder - b.sortOrder)),
    get: (idOrSlug) => read((db) => db.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug) ?? null),
    upsert: (product, actor) =>
      transact((db) => {
        const i = db.products.findIndex((p) => p.id === product.id);
        if (db.products.some((p) => p.slug === product.slug && p.id !== product.id)) throw new Error("Another product already uses this URL slug.");
        const before = i >= 0 ? db.products[i] : undefined;
        const next = { ...product, updatedAt: nowIso() };
        if (i >= 0) db.products[i] = next;
        else db.products.push(next);
        const priceChanged = before && before.priceMinor !== next.priceMinor;
        audit(db, actor, before ? (priceChanged ? "price.change" : "product.update") : "product.create", "product", next.id, `${next.name} · ${next.dialLabel} ${before ? "updated" : "created"}${priceChanged ? ` (price ${before.priceMinor} → ${next.priceMinor})` : ""}`);
        return next;
      }),
    collections: () => read((db) => db.collections),
    adjustStock: (deltas, actor) =>
      transact((db) => {
        for (const { id, delta } of deltas) {
          const p = db.products.find((x) => x.id === id);
          if (!p) continue;
          p.stockQuantity = Math.max(0, p.stockQuantity + delta);
          if (p.stockQuantity === 0) p.soldOut = true;
        }
        if (deltas.length) audit(db, actor, "inventory.adjust", "product", "*", `Stock adjusted for ${deltas.length} products`);
      }),
  },

  orders: {
    list: () => read((db) => [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    get: (ref) => read((db) => db.orders.find((o) => o.ref === ref) ?? null),
    create: (input, idempotencyKey) =>
      transact((db) => {
        const existing = db.orderKeys[idempotencyKey];
        if (existing) return { order: db.orders.find((o) => o.ref === existing)!, duplicate: true };
        db.counters.order += 1;
        const at = new Date(input.createdAt);
        const order: Order = { ...input, id: randomUUID(), ref: orderRef(db.counters.order, at) };
        db.orders.push(order);
        db.orderKeys[idempotencyKey] = order.ref;

        // Upsert the customer by phone (or email).
        let customer = db.customers.find((c) => c.phone === order.customer.phone || c.email === order.customer.email);
        if (!customer) {
          customer = {
            id: order.customerId,
            name: order.customer.name,
            phone: order.customer.phone,
            email: order.customer.email,
            createdAt: order.createdAt,
            lastOrderAt: null,
            orderRefs: [],
            marketingConsent: order.customer.marketingConsent,
            addresses: [],
            notes: [],
          };
          db.customers.push(customer);
        }
        order.customerId = customer.id;
        customer.name = order.customer.name;
        customer.lastOrderAt = order.createdAt;
        customer.orderRefs.push(order.ref);
        customer.marketingConsent = order.customer.marketingConsent;
        if (order.fulfilment.method === "delivery") {
          const addr = { governorate: order.fulfilment.governorate, city: order.fulfilment.city, address: order.fulfilment.address, landmark: order.fulfilment.landmark };
          if (!customer.addresses.some((a) => a.address === addr.address && a.city === addr.city)) customer.addresses.unshift(addr);
        }
        audit(db, { id: "customer", label: "Customer (checkout)" }, "order.create", "order", order.ref, `Order ${order.ref} placed (${order.payment.method})`);
        return { order, duplicate: false };
      }),
    setStatus: (ref, status, note, actor) =>
      transact((db) => {
        const o = mustOrder(db, ref);
        const before = o.status;
        o.status = status;
        o.updatedAt = nowIso();
        o.history.push({ status, at: o.updatedAt, by: actor.label, note });
        audit(db, actor, "order.status", "order", ref, `${before} → ${status}${note ? ` · ${note}` : ""}`);
        return o;
      }),
    setPaymentStatus: (ref, status, actor) =>
      transact((db) => {
        const o = mustOrder(db, ref);
        const before = o.payment.status;
        o.payment.status = status;
        if (status === "confirmed") {
          o.payment.confirmedAt = nowIso();
          o.payment.confirmedBy = actor.label;
        }
        o.updatedAt = nowIso();
        audit(db, actor, "payment.status", "order", ref, `Payment ${before} → ${status}`);
        return o;
      }),
    addNote: (ref, text, actor) =>
      transact((db) => {
        const o = mustOrder(db, ref);
        o.internalNotes.push({ at: nowIso(), by: actor.label, text });
        o.updatedAt = nowIso();
        audit(db, actor, "order.note", "order", ref, "Internal note added");
        return o;
      }),
    updateFulfilment: (ref, patch, actor) =>
      transact((db) => {
        const o = mustOrder(db, ref);
        o.fulfilment = { ...o.fulfilment, ...patch };
        o.updatedAt = nowIso();
        audit(db, actor, "order.fulfilment", "order", ref, "Delivery details updated");
        return o;
      }),
  },

  customers: {
    list: () => read((db) => [...db.customers].sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""))),
    get: (id) => read((db) => db.customers.find((c) => c.id === id) ?? null),
    addNote: (id, text, actor) =>
      transact((db) => {
        const c = db.customers.find((x) => x.id === id);
        if (!c) throw new Error("Customer not found");
        c.notes.push({ at: nowIso(), by: actor.label, text });
        audit(db, actor, "customer.note", "customer", id, "Internal note added");
      }),
  },

  auctions: {
    list: () => read((db) => db.auctions),
    get: (idOrSlug) => read((db) => db.auctions.find((a) => a.id === idOrSlug || a.slug === idOrSlug) ?? null),
    upsert: (auction, actor) =>
      transact((db) => {
        const i = db.auctions.findIndex((a) => a.id === auction.id);
        if (db.auctions.some((a) => a.slug === auction.slug && a.id !== auction.id)) throw new Error("Another auction already uses this URL slug.");
        const next = { ...auction, updatedAt: nowIso(), version: (i >= 0 ? db.auctions[i].version : 0) + 1 };
        if (i >= 0) db.auctions[i] = next;
        else db.auctions.push(next);
        audit(db, actor, i >= 0 ? "auction.update" : "auction.create", "auction", next.id, `${next.title} saved (${next.adminStatus})`);
        return next;
      }),
    bids: (auctionId) => read((db) => db.bids.filter((b) => b.auctionId === auctionId).sort((a, b) => b.placedAt.localeCompare(a.placedAt))),
    bidders: () => read((db) => db.bidders),
    upsertBidder: (profile) =>
      transact((db) => {
        const existing = db.bidders.find((b) => b.email === profile.email);
        if (existing) {
          Object.assign(existing, { name: profile.name, phone: profile.phone, verified: existing.verified || profile.verified });
          return existing;
        }
        db.counters.bidder += 1;
        const created: BidderProfile = { ...profile, id: randomUUID(), createdAt: nowIso(), publicLabel: `Bidder ${db.counters.bidder}` };
        db.bidders.push(created);
        return created;
      }),
    placeBid: (input) =>
      transact((db) => {
        // Inside the single write queue: equivalent to SELECT … FOR UPDATE on the auction row.
        const auction = db.auctions.find((a) => a.id === input.auctionId) ?? null;
        if (!auction) return { ok: false as const, error: "not_open" as const, auction: null };
        const bidder = db.bidders.find((b) => b.id === input.bidderId);
        const now = new Date();
        const windowStart = now.getTime() - 60_000;
        const recent = db.bids.filter((b) => b.bidderId === input.bidderId && Date.parse(b.placedAt) >= windowStart).length;
        const keys = new Set(db.bids.filter((b) => b.auctionId === auction.id).map((b) => b.idempotencyKey));
        if (auction.mode === "live" && input.demonstration) return { ok: false as const, error: "live_bidding_disabled" as const, auction };
        if (auction.mode === "demonstration" && !input.demonstration) return { ok: false as const, error: "live_bidding_disabled" as const, auction };
        const attempt = {
          bidderId: input.bidderId,
          bidderVerified: Boolean(bidder?.verified),
          bidderIsOwner: input.bidderIsOwner,
          amountMinor: input.amountMinor,
          idempotencyKey: input.idempotencyKey,
          expectedVersion: input.expectedVersion,
        };
        const error = validateBid(auction, attempt, { now, recentBidsByBidder: recent, maxBidsPerWindow: 5, seenIdempotencyKeys: keys });
        if (error) {
          if (error !== "duplicate") {
            db.bids.push({ id: randomUUID(), auctionId: auction.id, bidderId: input.bidderId, bidderLabel: bidder?.publicLabel ?? "Bidder", amountMinor: input.amountMinor, placedAt: now.toISOString(), idempotencyKey: input.idempotencyKey, demonstration: input.demonstration, status: "rejected", rejectReason: error, ipHash: input.ipHash });
          }
          return { ok: false as const, error, auction };
        }
        const next = applyBid(auction, attempt, now);
        const bid: Bid = { id: randomUUID(), auctionId: auction.id, bidderId: input.bidderId, bidderLabel: bidder?.publicLabel ?? "Bidder", amountMinor: input.amountMinor, placedAt: now.toISOString(), idempotencyKey: input.idempotencyKey, demonstration: input.demonstration, status: "accepted", ipHash: input.ipHash };
        Object.assign(auction, next);
        db.bids.push(bid);
        audit(db, { id: input.bidderId, label: bid.bidderLabel }, input.demonstration ? "bid.demo" : "bid.accepted", "auction", auction.id, `${input.demonstration ? "Demonstration bid" : "Bid"} ${input.amountMinor}`);
        return { ok: true as const, auction, bid };
      }),
    settle: (auctionId, actor) =>
      transact((db) => {
        const a = db.auctions.find((x) => x.id === auctionId);
        if (!a) throw new Error("Auction not found");
        const next = settleAuction(a, db.bids, new Date());
        Object.assign(a, next);
        audit(db, actor, "auction.settle", "auction", a.id, `Settled: ${a.adminStatus}`);
        return a;
      }),
  },

  settings: {
    get: () => read((db) => db.settings),
    update: (next, actor, summary) =>
      transact((db) => {
        const before = db.settings;
        db.settings = next;
        const pricingChanged = JSON.stringify(before.pricing) !== JSON.stringify(next.pricing) || JSON.stringify(before.shipping) !== JSON.stringify(next.shipping);
        audit(db, actor, pricingChanged ? "price.settings" : "settings.update", "settings", "site", summary, pricingChanged ? { pricing: before.pricing, shipping: before.shipping } : undefined, pricingChanged ? { pricing: next.pricing, shipping: next.shipping } : undefined);
        return next;
      }),
  },

  content: {
    get: () => read((db) => db.content),
    update: (next, actor) =>
      transact((db) => {
        db.content = next;
        audit(db, actor, "content.update", "content", "site", "Website content updated");
        return next;
      }),
  },

  misc: {
    addInquiry: (input) =>
      transact((db) => {
        const inquiry: Inquiry = { ...input, id: randomUUID(), createdAt: nowIso(), status: "new" };
        db.inquiries.unshift(inquiry);
        return inquiry;
      }),
    inquiries: () => read((db) => db.inquiries),
    setInquiryStatus: (id, status, actor) =>
      transact((db) => {
        const i = db.inquiries.find((x) => x.id === id);
        if (i) i.status = status;
        audit(db, actor, "inquiry.status", "inquiry", id, `Inquiry marked ${status}`);
      }),
    addWaitlist: (email, source) =>
      transact((db) => {
        const normalized = email.trim().toLowerCase();
        if (db.waitlist.some((w) => w.email === normalized)) return { added: false };
        db.waitlist.push({ id: randomUUID(), email: normalized, createdAt: nowIso(), source });
        return { added: true };
      }),
    waitlist: () => read((db) => db.waitlist),
    audit: (filter) =>
      read((db) => db.audit.filter((a) => !filter?.entity || a.entity === filter.entity).slice(0, filter?.limit ?? 200)),
    log: (entry) =>
      transact((db) => {
        db.audit.unshift({ ...entry, id: randomUUID(), at: nowIso() });
      }),
  },
};

export function resetDevStore() {
  write(seed());
}
