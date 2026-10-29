import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, FileSpreadsheet, FlaskConical, Mail, MessageSquareText, Pencil, Radio, Share2, ShieldCheck, Workflow, Landmark, BellRing, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { arEG } from "date-fns/locale";
import { Page, TopBar, Row } from "@/components/layout";
import { Glyph, AccountMark } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Field } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { db, uid } from "@/db/db";
import { useAccounts, useSources } from "@/db/hooks";
import { SOURCES, currentPlatform, type SourceInfo } from "@/engine/sources";
import { parseAlert, splitMessages } from "@/engine/sms";
import { detectMapping, parseCsv, statementToEvents, type CsvMapping } from "@/engine/csv";
import { SCENARIOS, scenarioEvents } from "@/engine/simulator";
import { matchAccount } from "@/engine/pipeline";
import type { SourceKind } from "@/engine/model";
import { captureText, ensureSource, ingestEvents } from "@/lib/capture";
import { useI18n } from "@/i18n";
import { usePrefs, useSheets } from "@/store/ui";
import { Money } from "@/components/Money";

const ICONS: Partial<Record<SourceKind, LucideIcon>> = {
  sms_paste: MessageSquareText,
  share_target: Share2,
  ios_shortcut: Workflow,
  statement_csv: FileSpreadsheet,
  manual: Pencil,
  android_sms: Radio,
  android_notification: BellRing,
  open_banking: Landmark,
  email: Mail,
  simulator: FlaskConical,
};

export default function Sources() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const connections = useSources();
  const devMode = usePrefs((s) => s.devMode);
  const [open, setOpen] = useState<SourceKind | null>(null);
  const platform = currentPlatform();

  const groups: { title: string; items: SourceInfo[] }[] = [
    { title: t("sources.available"), items: SOURCES.filter((s) => s.availability === "available") },
    { title: t("sources.needsNative"), items: SOURCES.filter((s) => s.availability === "needs_native_app") },
    { title: t("sources.needsPartner"), items: SOURCES.filter((s) => s.availability === "needs_partner" || s.availability === "planned") },
    ...(devMode ? [{ title: t("sources.developer"), items: SOURCES.filter((s) => s.availability === "dev_only") }] : []),
  ];

  return (
    <Page>
      <TopBar
        title={t("sources.title")}
        leading={
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label={t("common.back")}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
        }
      />
      <div className="mx-5 flex gap-3 rounded border border-rule bg-surface p-3 text-sm text-ink-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-pos" strokeWidth={1.75} />
        <p>{t("sources.promise")}</p>
      </div>

      {groups.map((g) => (
        <section key={g.title} className="pt-7">
          <h2 className="eyebrow px-5 pb-2">{g.title}</h2>
          <div className="border-y border-rule bg-surface">
            {g.items.map((s) => {
              const conn = connections.find((c) => c.kind === s.kind);
              const relevant = s.platforms.includes(platform) || platform === "web";
              return (
                <Row
                  key={s.kind}
                  onClick={() => setOpen(s.kind)}
                  chevron
                  leading={<Glyph icon={ICONS[s.kind] ?? Pencil} tone={conn?.status === "active" ? "accent" : "neutral"} />}
                  title={t(s.titleKey)}
                  subtitle={
                    <>
                      {t(`automation.${s.automation}`)} · <SourceStatus info={s} conn={conn} relevant={relevant} />
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      ))}
      <p className="px-5 pt-5 text-xs leading-relaxed text-ink-4">{t("sources.footer")}</p>

      <SourceSheet kind={open} onClose={() => setOpen(null)} />
    </Page>
  );
}

function SourceStatus({ info, conn, relevant }: { info: SourceInfo; conn?: { status: string; lastEventAt: number | null }; relevant: boolean }) {
  const { t, lang } = useI18n();
  if (info.availability === "needs_native_app") return <>{t("sources.status.native")}</>;
  if (info.availability === "needs_partner") return <>{t("sources.status.partner")}</>;
  if (info.availability === "planned") return <>{t("sources.status.planned")}</>;
  if (info.kind === "manual") return <>{t("sources.status.always")}</>;
  if (!relevant) return <>{t("sources.status.otherPlatform")}</>;
  if (!conn) return <>{t("sources.status.notSetUp")}</>;
  if (conn.status === "disconnected") return <span className="text-neg">{t("sources.status.disconnected")}</span>;
  return (
    <span>
      {t("sources.status.active")}
      {conn.lastEventAt ? ` · ${t("sources.status.last", { when: formatDistanceToNow(conn.lastEventAt, { addSuffix: true, locale: lang === "ar" ? arEG : undefined }) })}` : ""}
    </span>
  );
}

function SourceSheet({ kind, onClose }: { kind: SourceKind | null; onClose: () => void }) {
  const { t } = useI18n();
  const info = SOURCES.find((s) => s.kind === kind);
  const connections = useSources();
  const conn = connections.find((c) => c.kind === kind);
  return (
    <Sheet open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={info ? t(info.titleKey) : ""} description={info ? t(info.bodyKey) : undefined}>
        {info && (
          <div className="no-scrollbar overflow-y-auto px-5 pb-6 pt-4">
            <div className="rounded-sm bg-sunken p-3 text-sm text-ink-2">
              <div className="mb-1 text-xs font-semibold text-ink">{t("sources.canAccess")}</div>
              {t(info.accessKey)}
            </div>
            <div className="pt-5">
              {kind === "sms_paste" && <PastePanel onDone={onClose} />}
              {kind === "statement_csv" && <CsvPanel onDone={onClose} />}
              {kind === "ios_shortcut" && <ShortcutPanel />}
              {kind === "share_target" && <Steps keys={["src.share.s1", "src.share.s2", "src.share.s3"]} />}
              {kind === "manual" && <ManualPanel onDone={onClose} />}
              {kind === "simulator" && <SimulatorPanel />}
              {(kind === "android_sms" || kind === "android_notification") && <Steps keys={[`src.${kind === "android_sms" ? "androidSms" : "androidNotif"}.why`, "src.native.status"]} />}
              {kind === "open_banking" && <Steps keys={["src.openBanking.why"]} />}
              {kind === "email" && <Steps keys={["src.email.why"]} />}
            </div>
            {conn && conn.status === "active" && info.availability === "available" && kind !== "manual" && (
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={async () => {
                  await db.sources.update(conn.id, { status: "disconnected" });
                  toast(t("sources.disconnected"));
                }}
              >
                {t("sources.disconnect")}
              </Button>
            )}
            {conn && conn.status === "disconnected" && (
              <Button variant="secondary" className="mt-6 w-full" onClick={() => db.sources.update(conn.id, { status: "active" })}>
                {t("sources.reconnect")}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Steps({ keys }: { keys: string[] }) {
  const { t } = useI18n();
  return (
    <ol className="space-y-3">
      {keys.map((k, i) => (
        <li key={k} className="flex gap-3 text-sm leading-relaxed">
          {keys.length > 1 && <span className="fig flex size-6 shrink-0 items-center justify-center rounded-sm bg-ink text-xs font-semibold text-paper">{i + 1}</span>}
          <span className="text-ink-2">{t(k)}</span>
        </li>
      ))}
    </ol>
  );
}

function PastePanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const accounts = useAccounts();
  const { openReview } = useSheets();
  const [text, setText] = useState("");
  const preview = useMemo(() => splitMessages(text).map((m) => ({ m, r: parseAlert(m) })), [text]);
  return (
    <div>
      <Textarea rows={5} placeholder={t("paste.placeholder")} value={text} onChange={(e) => setText(e.target.value)} />
      {preview.length > 0 && (
        <ul className="mt-3 divide-y divide-rule rounded border border-rule">
          {preview.map(({ m, r }, i) => (
            <li key={i} className="px-3 py-2.5 text-sm">
              {r.ok ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-ink-2">
                    {t(r.fields.direction === "in" ? "dir.in" : r.fields.direction === "out" ? "dir.out" : "dir.unknown")}
                    {r.fields.merchant || r.fields.counterparty ? ` · ${r.fields.merchant ?? r.fields.counterparty}` : ""}
                    {" · "}
                    {matchAccount(accounts, r.fields.last4, r.fields.institution)?.name ?? t("paste.noAccount")}
                  </span>
                  <Money value={r.fields.amount ?? 0} currency={r.fields.currency ?? undefined} size="sm" className="font-medium" />
                </div>
              ) : (
                <span className={r.reason === "sensitive" ? "text-warn" : "text-ink-3"}>
                  {t(r.reason === "sensitive" ? "paste.sensitive" : "paste.unreadable")} — “{m.slice(0, 40)}…”
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ink"
        className="mt-4 w-full"
        disabled={!preview.some((p) => p.r.ok)}
        onClick={async () => {
          const s = await captureText(text, "sms_paste");
          const created = s.results.filter((r) => r.outcome === "created").length;
          const dup = s.results.filter((r) => r.outcome === "duplicate" || r.outcome === "merged").length;
          toast.success(t("paste.result", { created, dup }), { description: s.sensitive ? t("paste.sensitiveDropped", { count: s.sensitive }) : undefined });
          setText("");
          onDone();
          const first = s.results.find((r) => r.needsReview);
          if (first) setTimeout(() => openReview(first.transactionId), 250);
        }}
      >
        {t("paste.add")}
      </Button>
    </div>
  );
}

function CsvPanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const accounts = useAccounts();
  const file = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const events = useMemo(() => (rows && mapping && account ? statementToEvents(rows, mapping, account.id, account.currency) : []), [rows, mapping, account]);
  const ok = events.filter((e) => e.event);

  const col = (label: string, key: keyof CsvMapping) =>
    rows && mapping ? (
      <Field label={label}>
        <Select value={String(mapping[key] ?? -1)} onChange={(e) => setMapping({ ...mapping, [key]: Number(e.target.value) < 0 ? null : Number(e.target.value) })}>
          <option value={-1}>—</option>
          {rows[0].map((h, i) => (
            <option key={i} value={i}>
              {h || `#${i + 1}`}
            </option>
          ))}
        </Select>
      </Field>
    ) : null;

  return (
    <div className="space-y-4">
      <input
        ref={file}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const parsed = parseCsv(await f.text());
          setRows(parsed);
          const m = parsed[0] ? detectMapping(parsed[0]) : null;
          setMapping(m ?? { date: 0, description: 1, amount: 2, debit: null, credit: null, reference: null, negativeIsOut: true });
          if (!m) toast(t("csv.mapManually"));
        }}
      />
      <Button variant="outline" className="w-full" onClick={() => file.current?.click()}>
        <FileSpreadsheet /> {rows ? t("csv.chooseAnother") : t("csv.choose")}
      </Button>
      {rows && mapping && (
        <>
          <Field label={t("csv.account")}>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {col(t("csv.date"), "date")}
            {col(t("csv.description"), "description")}
            {col(t("csv.amount"), "amount")}
            {col(t("csv.reference"), "reference")}
            {col(t("csv.debit"), "debit")}
            {col(t("csv.credit"), "credit")}
          </div>
          <p className="text-sm text-ink-2">{t("csv.preview", { ok: ok.length, bad: events.length - ok.length })}</p>
          <Button
            variant="ink"
            className="w-full"
            disabled={!ok.length}
            onClick={async () => {
              await ensureSource("statement_csv");
              const res = await ingestEvents(ok.map((e) => e.event!));
              const created = res.filter((r) => r.outcome === "created").length;
              const merged = res.filter((r) => r.outcome === "merged").length;
              const dup = res.filter((r) => r.outcome === "duplicate").length;
              toast.success(t("csv.done", { created, merged, dup }));
              onDone();
            }}
          >
            {t("csv.import", { count: ok.length })}
          </Button>
        </>
      )}
    </div>
  );
}

function ShortcutPanel() {
  const { t } = useI18n();
  const url = `${location.origin}${location.pathname}?via=shortcut&capture=`;
  return (
    <div>
      <Steps keys={["src.shortcut.s1", "src.shortcut.s2", "src.shortcut.s3", "src.shortcut.s4"]} />
      <div className="mt-4 flex items-center gap-2 rounded-sm border border-rule bg-sunken p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{url}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard?.writeText(url);
            await ensureSource("ios_shortcut");
            toast.success(t("common.copied"));
          }}
        >
          <Copy /> {t("common.copy")}
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">{t("src.shortcut.limits")}</p>
    </div>
  );
}

function ManualPanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { openAdd } = useSheets();
  return (
    <Button
      variant="ink"
      className="w-full"
      onClick={() => {
        onDone();
        setTimeout(openAdd, 250);
      }}
    >
      {t("src.manual.cta")}
    </Button>
  );
}

const SIM_ACCOUNTS = [
  { institution: "cib", name: "CIB (sim)", kind: "bank" as const, last4: "1234", startingBalance: 2_500_000 },
  { institution: "telda", name: "Telda (sim)", kind: "card" as const, last4: "5678", startingBalance: 300_000 },
  { institution: "nbe", name: "NBE (sim)", kind: "bank" as const, last4: "9090", startingBalance: 800_000 },
  { institution: "vodafonecash", name: "Vodafone Cash (sim)", kind: "wallet" as const, last4: null, startingBalance: 50_000 },
  { institution: "cash", name: "Cash (sim)", kind: "cash" as const, last4: null, startingBalance: 0 },
];

function SimulatorPanel() {
  const { t } = useI18n();
  const accounts = useAccounts();
  const { openReview } = useSheets();
  const last4 = (inst: string) => accounts.find((a) => a.institution === inst)?.last4 ?? "0000";
  const missing = SIM_ACCOUNTS.filter((s) => !accounts.some((a) => a.institution === s.institution));
  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">{t("sim.intro")}</p>
      {missing.length > 0 && (
        <Button
          variant="outline"
          className="mb-4 w-full"
          onClick={async () => {
            await db.accounts.bulkAdd(missing.map((m, i) => ({ ...m, id: uid(), currency: "EGP", archived: false, createdAt: Date.now() + i, origin: "simulated" as const })));
            toast(t("sim.accountsAdded"));
          }}
        >
          {t("sim.addAccounts", { count: missing.length })}
        </Button>
      )}
      <div className="divide-y divide-rule rounded border border-rule">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            className="tap flex w-full items-center justify-between px-3 py-3 text-start text-sm"
            onClick={async () => {
              await ensureSource("simulator");
              const evs = scenarioEvents(s, last4);
              const dropped = evs.filter((e) => !e.event);
              const res = await ingestEvents(evs.filter((e) => e.event).map((e) => e.event!));
              const desc = res.map((r) => t(`outcome.${r.outcome}`)).concat(dropped.map((d) => t(`outcome.ignored_${d.reason === "sensitive" ? "sensitive" : "unreadable"}`))).join(" · ");
              toast(s.label, { description: desc });
              const first = res.find((r) => r.needsReview);
              if (first) openReview(first.transactionId);
            }}
          >
            {s.label}
            <span className="text-xs text-ink-4">{t("sim.run")}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-ink-3">
        {accounts.filter((a) => a.origin === "simulated").map((a) => (
          <AccountMark key={a.id} account={a} size="sm" />
        ))}
      </div>
    </div>
  );
}
