import { useDeferredValue, useMemo, useState } from "react";
import { endOfMonth, startOfMonth, subDays, subMonths } from "date-fns";
import { ChevronDown, ListChecks, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Page, TopBar, Empty } from "@/components/layout";
import { TxnRow } from "@/components/TxnRow";
import { SwipeableRow } from "@/components/SwipeableRow";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAccountMap, useAccounts, useCategories, useCategoryMap, useTransactions } from "@/db/hooks";
import type { Transaction } from "@/db/db";
import { collapseTransfers } from "@/engine/ledger";
import { deleteTransaction, restore } from "@/engine/actions";
import type { TxnKind } from "@/engine/model";
import { useI18n } from "@/i18n";
import { categoryName } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useSheets } from "@/store/ui";

type Range = "all" | "this_month" | "last_month" | "30d" | "90d";
interface Filters {
  kind: TxnKind | "all";
  accountId: string | null;
  categoryId: string | null;
  range: Range;
  review: boolean;
}
const NONE: Filters = { kind: "all", accountId: null, categoryId: null, range: "all", review: false };
const PAGE = 150;

function rangeBounds(r: Range): [number, number] | null {
  const now = new Date();
  if (r === "this_month") return [startOfMonth(now).getTime(), now.getTime() + 86_400_000];
  if (r === "last_month") return [startOfMonth(subMonths(now, 1)).getTime(), endOfMonth(subMonths(now, 1)).getTime()];
  if (r === "30d") return [subDays(now, 30).getTime(), now.getTime() + 86_400_000];
  if (r === "90d") return [subDays(now, 90).getTime(), now.getTime() + 86_400_000];
  return null;
}

export default function Activity() {
  const { t, day, num } = useI18n();
  const txns = useTransactions();
  const accounts = useAccounts();
  const accountMap = useAccountMap();
  const categories = useCategories();
  const cats = useCategoryMap();
  const { openReview, openDetail, openAdd } = useSheets();
  const [query, setQuery] = useState("");
  const [f, setF] = useState<Filters>(NONE);
  const [open, setOpen] = useState<keyof Filters | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());

  const reviewCount = useMemo(() => (txns ?? []).filter((x) => x.review === "needs_review").length, [txns]);

  const rows = useMemo(() => {
    const bounds = rangeBounds(f.range);
    const filtered = (txns ?? []).filter((x) => {
      if (f.review && x.review !== "needs_review") return false;
      if (f.kind !== "all" && x.kind !== f.kind) return false;
      if (f.accountId && x.accountId !== f.accountId) return false;
      if (f.categoryId && x.categoryId !== f.categoryId) return false;
      if (bounds && (x.occurredAt < bounds[0] || x.occurredAt > bounds[1])) return false;
      if (q) {
        const c = x.categoryId ? cats.get(x.categoryId) : null;
        const hay = [x.merchant, x.note, c && categoryName(c, t), accountMap.get(x.accountId ?? "")?.name, (x.amount / 100).toFixed(2)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return f.accountId ? filtered : collapseTransfers(filtered);
  }, [txns, f, q, cats, accountMap, t]);

  const groups = useMemo(() => {
    const out: { day: number; items: Transaction[]; net: number }[] = [];
    for (const x of rows.slice(0, limit)) {
      const last = out[out.length - 1];
      const v = x.kind === "transfer" || x.kind === "adjustment" || x.posting === "reversed" || x.posting === "failed" ? 0 : x.direction === "in" ? x.amount : -x.amount;
      if (last && last.day === x.date) {
        last.items.push(x);
        last.net += v;
      } else out.push({ day: x.date, items: [x], net: v });
    }
    return out;
  }, [rows, limit]);

  const active = f.kind !== "all" || f.accountId || f.categoryId || f.range !== "all" || f.review;

  async function remove(x: Transaction) {
    const snap = await deleteTransaction(x.id);
    if (snap) toast(t("detail.deleted"), { action: { label: t("common.undo"), onClick: () => restore(snap) } });
  }

  const chip = (key: keyof Filters, label: string, on: boolean) => (
    <button
      key={key}
      onClick={() => setOpen(key)}
      className={cn("flex h-8 shrink-0 items-center gap-1 rounded-sm border px-2.5 text-sm font-medium", on ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2")}
    >
      {label}
      <ChevronDown className="size-3.5 opacity-60" />
    </button>
  );

  return (
    <Page>
      <TopBar
        title={t("nav.activity")}
        actions={
          <Button variant="ghost" size="icon" aria-label={t("nav.add")} onClick={openAdd}>
            <Plus />
          </Button>
        }
      />
      <div className="sticky top-0 z-10 space-y-2 border-b border-rule bg-paper/95 px-5 pb-3 pt-1 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("activity.search")}
            className="h-10 w-full rounded border border-rule-strong bg-surface pe-9 ps-9 text-base outline-none placeholder:text-ink-4 focus:border-accent"
            enterKeyHint="search"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-3" aria-label={t("common.clear")}>
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
          <button
            onClick={() => setF((s) => ({ ...s, review: !s.review }))}
            className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-sm font-medium", f.review ? "border-accent bg-accent text-accent-contrast" : "border-rule-strong text-ink-2")}
          >
            {t("activity.needsReview")}
            <span className="fig text-xs opacity-70">{num(reviewCount)}</span>
          </button>
          {chip("kind", f.kind === "all" ? t("activity.type") : t(`kind.${f.kind}`), f.kind !== "all")}
          {chip("accountId", f.accountId ? accountMap.get(f.accountId)?.name ?? "" : t("activity.account"), !!f.accountId)}
          {chip("categoryId", f.categoryId ? categoryName(cats.get(f.categoryId), t) : t("activity.category"), !!f.categoryId)}
          {chip("range", f.range === "all" ? t("activity.date") : t(`range.${f.range}`), f.range !== "all")}
          {active && (
            <button onClick={() => setF(NONE)} className="h-8 shrink-0 px-2 text-sm font-medium text-accent-ink">
              {t("common.clear")}
            </button>
          )}
        </div>
      </div>

      {txns && txns.length === 0 ? (
        <Empty icon={<ListChecks />} title={t("activity.emptyTitle")} body={t("activity.emptyBody")} />
      ) : txns && rows.length === 0 ? (
        <Empty icon={<Search />} title={t("activity.noMatchTitle")} body={t("activity.noMatchBody")} />
      ) : (
        <div>
          {groups.map((g) => (
            <section key={g.day}>
              <div className="flex items-baseline justify-between px-5 pb-1.5 pt-5">
                <h2 className="text-sm font-semibold text-ink-2">{day(g.day)}</h2>
                {g.net !== 0 && <Money value={g.net} signed size="sm" tone="muted" />}
              </div>
              <div className="border-y border-rule">
                {g.items.map((x) => (
                  <SwipeableRow key={x.id} onDelete={() => remove(x)} label={t("common.delete")}>
                    <TxnRow t={x} cats={cats} accounts={accountMap} showAccount={!f.accountId} onClick={() => (x.review === "needs_review" ? openReview(x.id) : openDetail(x.id))} />
                  </SwipeableRow>
                ))}
              </div>
            </section>
          ))}
          {rows.length > limit && (
            <div className="px-5 pt-5">
              <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
                {t("activity.showOlder")}
              </Button>
            </div>
          )}
          <p className="px-5 pt-6 text-center text-xs text-ink-4">{t("activity.swipeHint")}</p>
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent title={open ? t(`activity.filter.${open}`) : ""}>
          <div className="no-scrollbar max-h-[60dvh] overflow-y-auto py-2">
            {open === "kind" &&
              (["all", "expense", "income", "transfer", "refund", "unknown", "adjustment"] as const).map((k) => (
                <Option key={k} on={f.kind === k} onClick={() => (setF((s) => ({ ...s, kind: k })), setOpen(null))}>
                  {k === "all" ? t("common.all") : t(`kind.${k}`)}
                </Option>
              ))}
            {open === "accountId" &&
              [null, ...accounts.map((a) => a.id)].map((id) => (
                <Option key={id ?? "all"} on={f.accountId === id} onClick={() => (setF((s) => ({ ...s, accountId: id })), setOpen(null))}>
                  {id ? accountMap.get(id)?.name : t("common.all")}
                </Option>
              ))}
            {open === "categoryId" &&
              [null, ...categories.map((c) => c.id)].map((id) => (
                <Option key={id ?? "all"} on={f.categoryId === id} onClick={() => (setF((s) => ({ ...s, categoryId: id })), setOpen(null))}>
                  {id ? categoryName(cats.get(id), t) : t("common.all")}
                </Option>
              ))}
            {open === "range" &&
              (["all", "this_month", "last_month", "30d", "90d"] as const).map((r) => (
                <Option key={r} on={f.range === r} onClick={() => (setF((s) => ({ ...s, range: r })), setOpen(null))}>
                  {r === "all" ? t("common.allTime") : t(`range.${r}`)}
                </Option>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="tap flex w-full items-center justify-between px-5 py-3 text-start text-base">
      {children}
      {on && <span className="size-2 rounded-full bg-accent" />}
    </button>
  );
}
