# Database design (PostgreSQL / Supabase)

The development store mirrors these tables as JSON. The Postgres driver implements `src/data/repositories/types.ts` against this schema. Money is `bigint` piastres; times are `timestamptz` (UTC; the admin shows Africa/Cairo).

## Schema (initial migration)

```sql
create extension if not exists pgcrypto;

-- Catalogue -------------------------------------------------------------
create table movement_families (
  id text primary key, name text not null, caliber text not null, maker text not null,
  complications text[] not null default '{}',
  jewels int, frequency_bph int, power_reserve_hours numeric, diameter_mm numeric, height_mm numeric,
  hacking boolean, hand_winding boolean, plain_language text not null default '',
  specs_source text not null default '', specs_verified boolean not null default false
);

create type component_type as enum ('movement','dial','case','hands','bezel','insert','crystal','chapterRing','band','clasp','caseback');
create type stock_status as enum ('in_stock','low','made_to_order','out_of_stock');

create table components (
  id text primary key,
  type component_type not null,
  code text not null unique,                 -- share-URL code, immutable once published
  name text not null, sku text not null unique,
  supplier text, supplier_ref text,
  cost_minor bigint check (cost_minor >= 0),  -- never exposed publicly (RLS / view)
  price_minor bigint not null check (price_minor >= 0),
  price_adjustment_minor bigint not null default 0,
  discount_eligible boolean not null default true,
  description text not null default '',
  images text[] not null default '{}',
  stock_status stock_status not null default 'in_stock',
  stock_quantity int check (stock_quantity >= 0),
  lead_time_days int,
  active boolean not null default false,
  sort_order int not null default 0,
  spec jsonb not null,                       -- validated by the Zod spec schema per type
  updated_at timestamptz not null default now()
);
create index on components (type, active, sort_order);

create type compat_status as enum ('compatible','incompatible','unconfirmed');
create table component_compatibility (
  id uuid primary key default gen_random_uuid(),
  a_id text not null references components(id) on delete cascade,
  b_id text not null references components(id) on delete cascade,
  status compat_status not null, note text not null default '', source text not null,
  updated_at timestamptz not null default now(),
  check (a_id < b_id)                          -- store each pair once, ordered
);
create unique index on component_compatibility (a_id, b_id);

create table component_preview_assets (
  id uuid primary key default gen_random_uuid(),
  component_id text not null references components(id) on delete cascade,
  view text not null check (view in ('front','rear')), slot text not null,
  storage_path text not null, width_px int not null, height_px int not null,
  px_per_mm numeric not null, anchor_x numeric not null, anchor_y numeric not null,
  rotation_deg numeric not null default 0, opacity numeric not null default 1, z_offset int not null default 0,
  status text not null check (status in ('draft','validated','published')), note text not null default '',
  updated_at timestamptz not null default now()
);

create table collections (id text primary key, slug text unique not null, name text not null, description text not null default '', sort_order int not null default 0);
create table products (
  id text primary key, slug text unique not null, name text not null, dial_label text not null,
  subtitle text not null default '', description text not null default '',
  price_minor bigint not null, compare_at_minor bigint,
  configuration jsonb not null, extra_specs jsonb not null default '[]',
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  status text not null check (status in ('draft','active','scheduled','hidden','archived')),
  release_at timestamptz, featured boolean not null default false, sold_out boolean not null default false,
  allow_customization boolean not null default true, max_per_order int not null default 1,
  seo jsonb not null default '{}', sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table product_images (id uuid primary key default gen_random_uuid(), product_id text references products(id) on delete cascade, storage_path text not null, alt text not null, width int, height int, position int not null default 0);
create table product_collections (product_id text references products(id) on delete cascade, collection_id text references collections(id) on delete cascade, primary key (product_id, collection_id));

-- Customers & orders ----------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text not null, email text not null,
  marketing_consent boolean not null default false,
  auth_user_id uuid unique,                    -- optional account link (later)
  created_at timestamptz not null default now()
);
create unique index on customers (phone);
create table addresses (id uuid primary key default gen_random_uuid(), customer_id uuid references customers(id) on delete cascade, governorate text, city text, address text, landmark text);
create table customer_notes (id uuid primary key default gen_random_uuid(), customer_id uuid references customers(id) on delete cascade, author text not null, body text not null, created_at timestamptz not null default now());
create table saved_builds (id uuid primary key default gen_random_uuid(), customer_id uuid references customers(id) on delete cascade, reference text not null, name text not null, configuration jsonb not null, created_at timestamptz not null default now());

create sequence order_number_seq;
create table orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,                    -- NVyymm-0001
  idempotency_key text unique not null,
  customer_id uuid not null references customers(id),
  status text not null, payment_method text not null, payment_status text not null,
  payment_reference text, payment_confirmed_at timestamptz, payment_confirmed_by text,
  fulfilment jsonb not null,                   -- method, address snapshot, carrier, tracking
  customer_snapshot jsonb not null,            -- name/phone/email at time of order
  subtotal_minor bigint not null, discount_minor bigint not null, shipping_minor bigint not null,
  tax_minor bigint not null, total_minor bigint not null,
  promo_code text, customer_note text, environment text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade,
  kind text not null, name text not null, build_ref text, encoded text, product_id text,
  quantity int not null check (quantity > 0), unit_minor bigint not null,
  lines jsonb not null, engraving jsonb
);
-- Immutable snapshot: historical orders never change when the catalogue does.
create table order_component_snapshots (
  order_item_id uuid references order_items(id) on delete cascade,
  slot text not null, component_id text not null, name text not null, sku text not null,
  price_minor bigint not null, cost_minor bigint, spec jsonb not null,
  primary key (order_item_id, slot)
);
create table order_status_events (id bigserial primary key, order_id uuid references orders(id) on delete cascade, status text not null, note text not null default '', actor text not null, at timestamptz not null default now());
create table order_internal_notes (id bigserial primary key, order_id uuid references orders(id) on delete cascade, actor text not null, body text not null, at timestamptz not null default now());
create table payment_evidence (id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade, storage_path text not null, mime text not null, size_bytes int not null, uploaded_at timestamptz not null default now());
create table shipments (id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade, carrier text, tracking_number text, shipped_at timestamptz, delivered_at timestamptz);

create table inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  component_id text references components(id), product_id text references products(id),
  order_id uuid references orders(id) on delete cascade, quantity int not null,
  status text not null check (status in ('held','consumed','released')), expires_at timestamptz
);

create table discounts (code text primary key, label text not null, kind text not null, value int not null, applies_to text not null, min_subtotal_minor bigint not null default 0, starts_at timestamptz, ends_at timestamptz, active boolean not null, usage_limit int, used_count int not null default 0);

-- Auctions ----------------------------------------------------------------
create table bidders (id uuid primary key default gen_random_uuid(), name text not null, email text unique not null, phone text not null, verified_at timestamptz, public_label text not null, created_at timestamptz not null default now());
create table auctions (
  id text primary key, slug text unique not null, title text not null, subtitle text not null default '',
  description text not null default '', specs jsonb not null default '[]', preview_build text, images text[] not null default '{}',
  starting_bid_minor bigint not null, increment_minor bigint not null, reserve_minor bigint,
  opens_at timestamptz not null, closes_at timestamptz not null,
  anti_snipe jsonb not null, admin_status text not null, mode text not null check (mode in ('demonstration','live')),
  published boolean not null default false, archived boolean not null default false,
  current_bid_minor bigint not null default 0, bid_count int not null default 0, leading_bidder_id uuid references bidders(id),
  winner jsonb, terms text not null default '', version int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create table auction_bids (
  id uuid primary key default gen_random_uuid(), auction_id text references auctions(id),
  bidder_id uuid references bidders(id), amount_minor bigint not null,
  placed_at timestamptz not null default now(), idempotency_key text not null,
  demonstration boolean not null, status text not null, reject_reason text, ip_hash text,
  unique (auction_id, idempotency_key)
);
create index on auction_bids (auction_id, placed_at desc);

-- Site --------------------------------------------------------------------
create table website_settings (id int primary key default 1 check (id = 1), data jsonb not null, updated_at timestamptz not null default now());
create table website_content  (id int primary key default 1 check (id = 1), data jsonb not null, updated_at timestamptz not null default now());
create table waitlist (id uuid primary key default gen_random_uuid(), email text unique not null, source text, created_at timestamptz not null default now());
create table inquiries (id uuid primary key default gen_random_uuid(), kind text not null, name text not null, email text not null, phone text, message text not null, details jsonb not null default '{}', status text not null default 'new', created_at timestamptz not null default now());
create table admin_users (id uuid primary key, email text unique not null, role text not null check (role in ('owner','staff')), created_at timestamptz not null default now());
create table audit_log (id bigserial primary key, at timestamptz not null default now(), actor text not null, action text not null, entity text not null, entity_id text not null, summary text not null, before jsonb, after jsonb);
```

`StorefrontMode` lives in `website_settings.data.storefront`; the proxy reads it through a small cached query (TTL a few seconds).

## Transactional bidding

`AuctionRepository.placeBid` becomes a single transaction. The domain functions `validateBid` and `applyBid` are unchanged; only the locking moves into SQL:

```sql
begin;
select * from auctions where id = $1 for update;          -- serialises bids per auction
-- server time:  now()   (never the client's clock)
-- rate limit:   select count(*) from auction_bids where bidder_id = $2 and placed_at > now() - interval '1 minute';
-- duplicates:   unique (auction_id, idempotency_key) rejects replays
-- validateBid(...) in application code with the locked row
insert into auction_bids (...) values (...);
update auctions set current_bid_minor = $3, bid_count = bid_count + 1, leading_bidder_id = $2,
       closes_at = $4, version = version + 1, updated_at = now() where id = $1;
commit;
```

Closing runs from a scheduled job (Supabase cron or a Vercel cron route) every minute. It calls `settleAuction` for auctions where `closes_at < now()` and `admin_status = 'scheduled'`, under the same row lock.

## Orders and inventory

Order creation runs in one transaction:

1. Insert the order, items and snapshots.
2. Decrement `components.stock_quantity` and `products.stock_quantity` with `… where stock_quantity >= $n`. If that fails, roll back with "sold out".
3. Increment discount usage with `… where used_count < usage_limit`.

The idempotency key is unique, so a retried submission returns the original order.

## Row-level security (Supabase)

- Public role: no direct table access. The storefront reads through server code using the service role, and only publishes the public catalogue view (no `cost_minor`, `supplier`, `supplier_ref`).
- Admin role: authenticated users present in `admin_users`. Policies on every table check `exists (select 1 from admin_users where id = auth.uid())`.
- `payment_evidence` lives in a **private** storage bucket and is served via signed URLs to admins only.

## Migrating from the development store

`.data/dev-db.json` has the same shapes. A one-off script can read it and insert in this order: movement families → components → compatibility → assets → collections → products → customers → orders → items → snapshots → events → auctions → bidders → bids → settings → content → audit. Development orders (`environment = 'development'`) should **not** be migrated.
