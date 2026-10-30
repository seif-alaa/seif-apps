import type { Auction, Bid } from "@/domain/auction";
import type { Catalog, CompatRecord, Component, MovementFamily, PreviewAsset } from "@/domain/catalog";
import type {
  AuditEntry,
  BidderProfile,
  Collection,
  Customer,
  Inquiry,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  WaitlistEntry,
} from "@/domain/models";
import type { Content, Settings } from "@/domain/settings";

/**
 * Repository contracts. The storefront, configurator, admin and API routes
 * depend only on these interfaces. `devRepositories` implements them over a
 * local JSON file for development; a Postgres/Supabase implementation will
 * implement the same contracts (see docs/DATABASE.md) without UI changes.
 */

export interface Actor {
  id: string;
  label: string;
}

export interface CatalogRepository {
  get(): Promise<Catalog>;
  upsertComponent(component: Component, actor: Actor): Promise<Component>;
  setComponentActive(id: string, active: boolean, actor: Actor): Promise<void>;
  upsertMovementFamily(family: MovementFamily, actor: Actor): Promise<void>;
  upsertCompat(record: CompatRecord, actor: Actor): Promise<void>;
  deleteCompat(id: string, actor: Actor): Promise<void>;
  upsertAsset(asset: PreviewAsset, actor: Actor): Promise<void>;
  deleteAsset(id: string, actor: Actor): Promise<void>;
  /** Decrement stock when an order is placed; returns ids that ran out. */
  adjustStock(deltas: { id: string; delta: number }[], actor: Actor): Promise<string[]>;
}

export interface ProductRepository {
  list(): Promise<Product[]>;
  get(idOrSlug: string): Promise<Product | null>;
  upsert(product: Product, actor: Actor): Promise<Product>;
  collections(): Promise<Collection[]>;
  adjustStock(deltas: { id: string; delta: number }[], actor: Actor): Promise<void>;
}

export interface OrderRepository {
  list(): Promise<Order[]>;
  get(ref: string): Promise<Order | null>;
  create(order: Omit<Order, "id" | "ref">, idempotencyKey: string): Promise<{ order: Order; duplicate: boolean }>;
  setStatus(ref: string, status: OrderStatus, note: string, actor: Actor): Promise<Order>;
  setPaymentStatus(ref: string, status: PaymentStatus, actor: Actor): Promise<Order>;
  addNote(ref: string, text: string, actor: Actor): Promise<Order>;
  updateFulfilment(ref: string, patch: Partial<Order["fulfilment"]>, actor: Actor): Promise<Order>;
}

export interface CustomerRepository {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer | null>;
  addNote(id: string, text: string, actor: Actor): Promise<void>;
}

export interface AuctionRepository {
  list(): Promise<Auction[]>;
  get(idOrSlug: string): Promise<Auction | null>;
  upsert(auction: Auction, actor: Actor): Promise<Auction>;
  bids(auctionId: string): Promise<Bid[]>;
  bidders(): Promise<BidderProfile[]>;
  upsertBidder(profile: Omit<BidderProfile, "id" | "createdAt" | "publicLabel">): Promise<BidderProfile>;
  /**
   * Atomically validate and record a bid. In production this runs inside a
   * transaction with a row lock on the auction (see docs/DATABASE.md).
   */
  placeBid(input: PlaceBidInput): Promise<PlaceBidResult>;
  settle(auctionId: string, actor: Actor): Promise<Auction>;
}

export interface PlaceBidInput {
  auctionId: string;
  bidderId: string;
  amountMinor: number;
  idempotencyKey: string;
  expectedVersion?: number;
  ipHash: string;
  demonstration: boolean;
  bidderIsOwner: boolean;
}

export type PlaceBidResult =
  | { ok: true; auction: Auction; bid: Bid }
  | { ok: false; error: import("@/domain/auction").BidError; auction: Auction | null };

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(next: Settings, actor: Actor, summary: string): Promise<Settings>;
}

export interface ContentRepository {
  get(): Promise<Content>;
  update(next: Content, actor: Actor): Promise<Content>;
}

export interface MiscRepository {
  addInquiry(inquiry: Omit<Inquiry, "id" | "createdAt" | "status">): Promise<Inquiry>;
  inquiries(): Promise<Inquiry[]>;
  setInquiryStatus(id: string, status: Inquiry["status"], actor: Actor): Promise<void>;
  addWaitlist(email: string, source: string): Promise<{ added: boolean }>;
  waitlist(): Promise<WaitlistEntry[]>;
  audit(filter?: { entity?: string; limit?: number }): Promise<AuditEntry[]>;
  log(entry: Omit<AuditEntry, "id" | "at">): Promise<void>;
}

export interface Repositories {
  driver: "dev" | "supabase";
  catalog: CatalogRepository;
  products: ProductRepository;
  orders: OrderRepository;
  customers: CustomerRepository;
  auctions: AuctionRepository;
  settings: SettingsRepository;
  content: ContentRepository;
  misc: MiscRepository;
}
