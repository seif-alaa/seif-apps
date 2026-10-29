import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import { Page, TopBar, Row, Section, Tag } from "@/components/layout";
import { Money } from "@/components/Money";
import { AccountMark } from "@/components/icons";
import { TxnRow } from "@/components/TxnRow";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { db, uid, type Account } from "@/db/db";
import { useAccountMap, useAccounts, useCategoryMap, useReconciliations, useTransactions } from "@/db/hooks";
import { accountBalance, balances, collapseTransfers, pendingAmount } from "@/engine/ledger";
import { INSTITUTIONS } from "@/engine/institutions";
import { trackingMode } from "@/engine/sources";
import type { AccountKind, SourceKind } from "@/engine/model";
import { refreshReconciliation, resolveWithAdjustment, startReconciliation } from "@/engine/actions";
import { CURRENCIES } from "@/lib/currencies";
import { useI18n } from "@/i18n";
import { useSheets } from "@/store/ui";
import { TrackingLabel } from "./Home";

export function AccountsList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const accounts = useAccounts(true);
  const txns = useTransactions() ?? [];
  const bal = useMemo(() => balances(accounts, txns), [accounts, txns]);
  const [sheet, setSheet] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null });
  return (
    <Page>
      <TopBar
        title={t("accounts.title")}
        leading={
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label={t("common.back")}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
        }
        actions={
          <Button variant="ghost" size="icon" onClick={() => setSheet({ open: true, account: null })} aria-label={t("accounts.add")}>
            <Plus />
          </Button>
        }
      />
      <div className="mt-2 border-y border-rule bg-surface">
        {accounts.map((a) => (
          <Row
            key={a.id}
            onClick={() => navigate(`/accounts/${a.id}`)}
            leading={<AccountMark account={a} />}
            title={a.name}
            subtitle={
              <span className="flex items-center gap-1.5">
                {t(`accountKind.${a.kind}`)}
                {a.last4 && <span className="fig">•{a.last4}</span>}
                {a.archived && <Tag>{t("accounts.archived")}</Tag>}
                {a.origin && a.origin !== "real" && <Tag tone="outline">{t(`origin.${a.origin}`)}</Tag>}
              </span>
            }
            trailing={<Money value={bal.get(a.id) ?? 0} currency={a.currency} className="font-medium" />}
          />
        ))}
      </div>
      <p className="px-5 pt-4 text-xs leading-relaxed text-ink-4">{t("accounts.last4Hint")}</p>
      <AccountSheet open={sheet.open} account={sheet.account} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />
    </Page>
  );
}

export function AccountDetail() {
  const { id } = useParams();
  const { t, day, time } = useI18n();
  const navigate = useNavigate();
  const accountMap = useAccountMap();
  const cats = useCategoryMap();
  const txns = useTransactions() ?? [];
  const recs = useReconciliations();
  const { openDetail, openReview, openAdd } = useSheets();
  const account = id ? accountMap.get(id) : undefined;
  const [edit, setEdit] = useState(false);
  const [verify, setVerify] = useState(false);
  const mine = useMemo(() => txns.filter((x) => x.accountId === id), [txns, id]);
  const sources = useMemo(() => {
    const m = new Map<SourceKind, { count: number; last: number }>();
    for (const x of mine) {
      const s = m.get(x.source) ?? { count: 0, last: 0 };
      s.count++;
      s.last = Math.max(s.last, x.detectedAt);
      m.set(x.source, s);
    }
    return m;
  }, [mine]);
  if (!account) return <Page>{null}</Page>;
  const balance = accountBalance(account, txns);
  const pending = pendingAmount(account.id, txns);
  const open = recs.filter((r) => r.accountId === account.id && r.status === "open").sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <Page>
      <TopBar
        title={account.name}
        leading={
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label={t("common.back")}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={() => setEdit(true)}>
            {t("common.edit")}
          </Button>
        }
      />
      <section className="px-5 pt-2">
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <AccountMark account={account} size="sm" />
          <TrackingLabel mode={trackingMode(new Set(sources.keys()), false)} />
        </div>
        <div className="mt-3">
          <Money value={balance} currency={account.currency} size="hero" animateChanges />
        </div>
        {pending !== 0 && (
          <div className="mt-1 text-sm text-ink-3">
            {t("home.pending")} <Money value={pending} currency={account.currency} size="sm" tone="muted" signed />
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-4 flex" onClick={() => setVerify(true)}>
          <Scale /> {t("rec.verify")}
        </Button>
      </section>

      {open && (
        <section className="mx-5 mt-6 rounded border border-warn/50 bg-warn-wash p-4">
          <div className="text-sm font-semibold">{t("rec.openTitle")}</div>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">{t("rec.expected")}</dt>
              <Money value={open.expected} currency={account.currency} size="sm" />
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">{t("rec.verified")}</dt>
              <Money value={open.verified} currency={account.currency} size="sm" />
            </div>
            <div className="flex justify-between border-t border-warn/30 pt-1 font-medium">
              <dt>{t("rec.difference")}</dt>
              <Money value={open.difference} currency={account.currency} size="sm" signed />
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-2">{t("rec.explain")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => openReview()}>
              {t("rec.reviewQueue")}
            </Button>
            <Button size="sm" variant="secondary" onClick={openAdd}>
              {t("rec.addMissing")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const r = await refreshReconciliation(open.id);
                toast(r?.status === "resolved" ? t("rec.balanced") : t("rec.stillOff"));
              }}
            >
              {t("rec.recheck")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await resolveWithAdjustment(open.id);
                toast.success(t("rec.adjusted"));
              }}
            >
              {t("rec.adjust")}
            </Button>
          </div>
        </section>
      )}

      {sources.size > 0 && (
        <Section title={t("accounts.dataFrom")}>
          {[...sources.entries()].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-t border-rule px-5 py-2.5 text-sm first:border-t-0">
              <span>{t(`source.${k}`)}</span>
              <span className="text-ink-3">{t("accounts.sourceLine", { count: v.count, when: `${day(v.last)} ${time(v.last)}` })}</span>
            </div>
          ))}
        </Section>
      )}

      <Section title={t("home.recent")}>
        {mine.length === 0 ? (
          <p className="px-5 py-5 text-sm text-ink-3">{t("accounts.noTxns")}</p>
        ) : (
          collapseTransfers(mine)
            .slice(0, 30)
            .map((x) => <TxnRow key={x.id} t={x} cats={cats} accounts={accountMap} showAccount={false} onClick={() => (x.review === "needs_review" ? openReview(x.id) : openDetail(x.id))} />)
        )}
      </Section>

      <AccountSheet open={edit} account={account} onOpenChange={setEdit} />
      <VerifySheet open={verify} account={account} onOpenChange={setVerify} />
    </Page>
  );
}

function VerifySheet({ open, account, onOpenChange }: { open: boolean; account: Account; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue("");
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={t("rec.verifyTitle")} description={t("rec.verifyBody")}>
        <div className="space-y-4 px-5 pb-6 pt-4">
          <Field label={t("rec.actualBalance", { currency: account.currency })}>
            <Input autoFocus inputMode="decimal" className="fig text-lg" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
          </Field>
          <Button
            variant="ink"
            className="w-full"
            disabled={!value.trim()}
            onClick={async () => {
              const minor = Math.round(parseFloat(value.replace(/,/g, "")) * 100);
              if (!Number.isFinite(minor)) return;
              const r = await startReconciliation(account.id, minor);
              toast(r.status === "resolved" ? t("rec.matches") : t("rec.mismatch"));
              onOpenChange(false);
            }}
          >
            {t("rec.compare")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AccountSheet({ open, account, onOpenChange }: { open: boolean; account: Account | null; onOpenChange: (o: boolean) => void }) {
  const { t, currency } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [inst, setInst] = useState("other");
  const [last4, setLast4] = useState("");
  const [cur, setCur] = useState(currency);
  const [opening, setOpening] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setKind(account?.kind ?? "bank");
    setInst(account?.institution ?? "other");
    setLast4(account?.last4 ?? "");
    setCur(account?.currency ?? currency);
    setOpening(account ? String(account.startingBalance / 100) : "");
  }, [open, account, currency]);

  async function save() {
    if (!name.trim()) return toast(t("accounts.needName"));
    if (last4 && !/^\d{4}$/.test(last4)) return toast(t("accounts.badLast4"));
    const patch = { name: name.trim(), kind, institution: inst, last4: last4 || null, currency: cur, startingBalance: Math.round((parseFloat(opening.replace(/,/g, "")) || 0) * 100) };
    if (account) await db.accounts.update(account.id, patch);
    else await db.accounts.add({ ...patch, id: uid(), archived: false, createdAt: Date.now() });
    toast.success(t("common.saved"));
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={account ? t("accounts.edit") : t("accounts.add")}>
        <div className="no-scrollbar space-y-4 overflow-y-auto px-5 pb-6 pt-4">
          <Field label={t("accounts.institution")}>
            <Select
              value={inst}
              onChange={(e) => {
                setInst(e.target.value);
                const i = INSTITUTIONS.find((x) => x.key === e.target.value);
                if (i) {
                  setKind(i.kind);
                  if (!name) setName(i.name);
                }
              }}
            >
              {INSTITUTIONS.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name} {i.nameAr !== i.name ? `· ${i.nameAr}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("accounts.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={28} />
          </Field>
          <Segmented<AccountKind>
            value={kind}
            onChange={setKind}
            size="sm"
            options={(["bank", "card", "credit", "wallet", "cash"] as const).map((k) => ({ value: k, label: t(`accountKind.${k}`) }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("accounts.last4")} hint={t("accounts.last4Short")}>
              <Input inputMode="numeric" maxLength={4} className="fig" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} placeholder="1234" />
            </Field>
            <Field label={t("accounts.currency")}>
              <Select value={cur} onChange={(e) => setCur(e.target.value)} disabled={!!account}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("accounts.opening")} hint={t("accounts.openingHint")}>
            <Input inputMode="decimal" className="fig" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0.00" />
          </Field>
          <div className="flex gap-2">
            {account && (
              <Button
                variant="secondary"
                onClick={async () => {
                  await db.accounts.update(account.id, { archived: !account.archived });
                  onOpenChange(false);
                  if (!account.archived) navigate("/accounts");
                }}
              >
                {account.archived ? t("accounts.unarchive") : t("accounts.archive")}
              </Button>
            )}
            <Button variant="ink" className="flex-1" onClick={save}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
