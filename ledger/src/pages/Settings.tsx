import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { Page, TopBar } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CategoryGlyph, ICON_CHOICES, CATEGORY_ICONS } from "@/components/icons";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { db, uid } from "@/db/db";
import { useCategories, useSources } from "@/db/hooks";
import { ensureBasics, exportData, importData, loadSampleData, wipeAll } from "@/db/seed";
import { CURRENCIES } from "@/lib/currencies";
import { requestNotificationPermission } from "@/lib/notify";
import { categoryName } from "@/lib/labels";
import { useI18n } from "@/i18n";
import { usePrefs, type NotifyPref, type ThemePref } from "@/store/ui";
import { cn } from "@/lib/utils";

function Group({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="pt-7">
      <h2 className="eyebrow px-5 pb-2">{title}</h2>
      <div className="divide-y divide-rule border-y border-rule bg-surface">{children}</div>
      {footer && <p className="px-5 pt-2 text-xs leading-relaxed text-ink-3">{footer}</p>}
    </section>
  );
}

function Line({ label, hint, children, onClick }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cn("flex min-h-[52px] w-full items-center justify-between gap-3 px-5 py-2.5 text-start", onClick && "tap")}>
      <div className="min-w-0">
        <div className="text-base">{label}</div>
        {hint && <div className="text-xs text-ink-3">{hint}</div>}
      </div>
      {children}
      {onClick && !children && <ChevronRight className="size-4 shrink-0 text-ink-4 rtl:rotate-180" />}
    </C>
  );
}

function Confirm({ trigger, title, body, confirm, onConfirm }: { trigger: ReactNode; title: string; body: string; confirm: string; onConfirm: () => void }) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{body}</AlertDialogDescription>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const p = usePrefs();
  const sources = useSources();
  const evidence = useLiveQuery(() => db.events.filter((e) => !!e.evidence).count(), []) ?? 0;
  const file = useRef<HTMLInputElement>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [perm, setPerm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const active = sources.filter((s) => s.status === "active").length;

  async function doExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const name = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const f = new File([blob], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: "Ledger backup" });
        return;
      } catch {
        /* cancelled — fall back to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Page>
      <TopBar
        title={t("nav.settings")}
        leading={
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label={t("common.back")}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
        }
      />

      <Group title={t("settings.sourcesGroup")}>
        <Line label={t("sources.title")} hint={t("settings.sourcesHint", { count: active })} onClick={() => navigate("/sources")} />
        <Line label={t("accounts.title")} onClick={() => navigate("/accounts")} />
        <Line label={t("settings.categories")} onClick={() => setCatsOpen(true)} />
      </Group>

      <Group title={t("settings.automation")} footer={t("settings.automationFooter")}>
        <Line label={t("settings.autoFile")} hint={t("settings.autoFileHint")}>
          <Switch checked={p.autoCategorize} onCheckedChange={(v) => p.setPrefs({ autoCategorize: v })} />
        </Line>
        <div className="px-5 py-3">
          <div className="mb-2 text-base">{t("settings.confidence")}</div>
          <Segmented<"balanced" | "cautious">
            value={p.cautious ? "cautious" : "balanced"}
            onChange={(v) => p.setPrefs({ cautious: v === "cautious" })}
            options={[
              { value: "balanced", label: t("settings.balanced") },
              { value: "cautious", label: t("settings.cautious") },
            ]}
          />
        </div>
        <Line label={t("settings.matchTransfers")} hint={t("settings.matchTransfersHint")}>
          <Switch checked={p.autoMatchTransfers} onCheckedChange={(v) => p.setPrefs({ autoMatchTransfers: v })} />
        </Line>
        <div className="px-5 py-3">
          <div className="mb-1 text-base">{t("settings.notifications")}</div>
          <div className="mb-2 text-xs text-ink-3">{t(`settings.perm.${perm}`)}</div>
          <Segmented<NotifyPref>
            value={p.notify}
            onChange={async (v) => {
              p.setPrefs({ notify: v });
              if (v !== "off") setPerm((await requestNotificationPermission()) as typeof perm);
            }}
            options={[
              { value: "off", label: t("settings.notifyOff") },
              { value: "review", label: t("settings.notifyReview") },
              { value: "all", label: t("settings.notifyAll") },
            ]}
          />
        </div>
      </Group>

      <Group title={t("settings.preferences")}>
        <div className="px-5 py-3">
          <label className="mb-1.5 block text-sm text-ink-2">{t("settings.name")}</label>
          <Input value={p.name} onChange={(e) => p.setPrefs({ name: e.target.value })} maxLength={24} />
        </div>
        <Line label={t("settings.language")}>
          <Segmented<"en" | "ar"> size="sm" className="w-40" value={p.language} onChange={(language) => p.setPrefs({ language })} options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} />
        </Line>
        {p.language === "ar" && (
          <Line label={t("settings.digits")}>
            <Segmented<"arab" | "latn"> size="sm" className="w-40" value={p.digits} onChange={(digits) => p.setPrefs({ digits })} options={[{ value: "arab", label: "١٢٣" }, { value: "latn", label: "123" }]} />
          </Line>
        )}
        <Line label={t("settings.currency")} hint={t("settings.currencyHint")}>
          <Select className="w-28" value={p.currency} onChange={(e) => p.setPrefs({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Line>
        <div className="px-5 py-3">
          <div className="mb-2 text-base">{t("settings.appearance")}</div>
          <Segmented<ThemePref>
            value={p.theme}
            onChange={(theme) => p.setPrefs({ theme })}
            options={[
              { value: "system", label: t("settings.system") },
              { value: "light", label: t("settings.light") },
              { value: "dark", label: t("settings.dark") },
            ]}
          />
        </div>
        <Line label={t("settings.hideAmounts")} hint={t("settings.hideAmountsHint")}>
          <Switch checked={p.hideAmounts} onCheckedChange={(v) => p.setPrefs({ hideAmounts: v })} />
        </Line>
      </Group>

      <Group title={t("settings.privacy")} footer={t("settings.privacyFooter")}>
        <Line label={t("settings.keepEvidence")} hint={t("settings.keepEvidenceHint")}>
          <Switch checked={p.keepEvidence} onCheckedChange={(v) => p.setPrefs({ keepEvidence: v })} />
        </Line>
        <Line
          label={t("settings.clearEvidence")}
          hint={t("settings.evidenceCount", { count: evidence })}
          onClick={async () => {
            await db.events.toCollection().modify({ evidence: null });
            toast(t("settings.evidenceCleared"));
          }}
        />
        <Line label={t("settings.export")} hint={t("settings.exportHint")} onClick={doExport} />
        <Line label={t("settings.import")} hint={t("settings.importHint")} onClick={() => file.current?.click()} />
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await importData(JSON.parse(await f.text()));
              p.setPrefs({ sampleMode: false });
              toast.success(t("settings.restored"));
            } catch {
              toast.error(t("settings.badBackup"));
            }
          }}
        />
        <Confirm
          trigger={
            <button className="tap flex min-h-[52px] w-full items-center px-5 text-start text-base text-neg">{t("settings.erase")}</button>
          }
          title={t("settings.eraseTitle")}
          body={t("settings.eraseBody")}
          confirm={t("settings.eraseConfirm")}
          onConfirm={async () => {
            await wipeAll();
            await ensureBasics();
            p.setPrefs({ sampleMode: false });
            toast(t("settings.erased"));
            navigate("/");
          }}
        />
      </Group>

      <Group title={t("settings.developer")}>
        <Line label={t("settings.devMode")} hint={t("settings.devModeHint")}>
          <Switch checked={p.devMode} onCheckedChange={(v) => p.setPrefs({ devMode: v })} />
        </Line>
        <Confirm
          trigger={<button className="tap flex min-h-[52px] w-full items-center px-5 text-start text-base">{t("settings.loadSample")}</button>}
          title={t("settings.loadSampleTitle")}
          body={t("settings.loadSampleBody")}
          confirm={t("settings.loadSampleConfirm")}
          onConfirm={async () => {
            await loadSampleData();
            p.setPrefs({ sampleMode: true });
            navigate("/");
          }}
        />
      </Group>

      <p className="px-5 pt-8 text-center text-xs leading-relaxed text-ink-4">{t("settings.about")}</p>
      <CategoriesSheet open={catsOpen} onOpenChange={setCatsOpen} />
    </Page>
  );
}

function CategoriesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const categories = useCategories();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("tag");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={t("settings.categories")}>
        <div className="no-scrollbar overflow-y-auto pb-6">
          <div className="mt-3 divide-y divide-rule border-y border-rule">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-2">
                <CategoryGlyph category={c} size="sm" />
                <span className="flex-1 text-base">{categoryName(c, t)}</span>
                <span className="text-xs text-ink-3">{t(c.kind === "income" ? "dir.in" : "dir.out")}</span>
                {!c.key && (
                  <button
                    className="text-sm text-neg"
                    onClick={async () => {
                      const used = await db.transactions.where("categoryId").equals(c.id).count();
                      if (used) return toast(t("settings.catInUse", { count: used }));
                      await db.categories.delete(c.id);
                      await db.budgets.delete(c.id);
                    }}
                  >
                    {t("common.remove")}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-3 px-5 pt-5">
            <div className="text-sm font-semibold">{t("settings.newCategory")}</div>
            <Input placeholder={t("settings.categoryName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
            <div className="flex flex-wrap gap-1.5">
              {ICON_CHOICES.map((k) => {
                const I = CATEGORY_ICONS[k];
                return (
                  <button key={k} onClick={() => setIcon(k)} aria-label={k} className={cn("flex size-9 items-center justify-center rounded border", icon === k ? "border-ink bg-sunken" : "border-rule")}>
                    <I className="size-4" strokeWidth={1.75} />
                  </button>
                );
              })}
            </div>
            <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: t("dir.out") }, { value: "income", label: t("dir.in") }]} />
            <Button
              variant="ink"
              className="w-full"
              onClick={async () => {
                if (!name.trim()) return;
                await db.categories.add({ id: uid(), key: null, name: name.trim(), icon, kind, slot: 1, createdAt: Date.now() });
                setName("");
                toast.success(t("common.saved"));
              }}
            >
              {t("common.add")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
