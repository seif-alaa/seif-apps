import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Download, Lock, Moon, Plus, Sparkles, Sun, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Page, Reveal } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CategoryBadge } from "@/components/CategoryBadge";
import { useCategories } from "@/db/hooks";
import { db, uid, type TxnType } from "@/db/db";
import { ensureBasics, exportData, importData, loadSampleData, wipeAll } from "@/db/seed";
import { CURRENCIES } from "@/lib/format";
import { usePrefs, type ThemePref } from "@/store/ui";
import { cn } from "@/lib/utils";

function Section({ title, children, i }: { title: string; children: ReactNode; i: number }) {
  return (
    <Reveal i={i} className="px-5 pt-5">
      <h2 className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="surface-card divide-y divide-border/70 overflow-hidden p-0">{children}</div>
    </Reveal>
  );
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[15px] font-medium">{label}</div>
        {hint && <div className="text-[13px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Confirm({ trigger, title, body, confirm, onConfirm }: { trigger: ReactNode; title: string; body: string; confirm: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{body}</AlertDialogDescription>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Settings() {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const categories = useCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState({ emoji: "🌟", name: "", kind: "expense" as TxnType });

  async function doExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const file = new File([blob], `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: "application/json" });
    // iOS: the share sheet lets you save to Files or AirDrop it.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Ledger backup" });
        return;
      } catch {
        /* cancelled — fall through to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Backup saved 💾");
  }

  async function doImport(f: File) {
    try {
      await importData(JSON.parse(await f.text()));
      toast.success("Welcome back! Backup restored 🎉");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read that file.");
    }
  }

  async function addCategory() {
    if (!newCat.name.trim()) return toast.error("Name it something fun 🙂");
    const sameKind = categories.filter((c) => c.kind === newCat.kind);
    const slot = SLOTS[sameKind.length % SLOTS.length];
    await db.categories.add({ id: uid(), name: newCat.name.trim(), emoji: newCat.emoji || "🌟", kind: newCat.kind, slot, createdAt: Date.now() });
    setNewCat({ emoji: "🌟", name: "", kind: newCat.kind });
    setAdding(false);
    toast.success("Category added");
  }

  async function removeCategory(id: string) {
    const used = await db.transactions.where("categoryId").equals(id).count();
    if (used) return toast.error(`Used by ${used} transaction${used === 1 ? "" : "s"}`, { description: "I'll keep it so your history stays intact." });
    await db.categories.delete(id);
    await db.budgets.delete(id);
  }

  return (
    <Page>
      <header className="flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+14px)]">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="!size-6" />
        </Button>
        <h1 className="text-[26px] font-bold tracking-tight">Settings</h1>
      </header>

      <Section title="You" i={0}>
        <div className="px-4 py-3">
          <label className="mb-1.5 block text-[13px] text-muted-foreground">What should I call you?</label>
          <Input value={prefs.name} onChange={(e) => prefs.setPrefs({ name: e.target.value })} placeholder="Your first name" maxLength={20} />
        </div>
        <Row label="Currency">
          <select
            value={prefs.currency}
            onChange={(e) => prefs.setPrefs({ currency: e.target.value })}
            className="h-10 max-w-[60%] rounded-xl border border-input bg-card px-3 text-[15px] outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.label}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Look & feel" i={1}>
        <div className="px-4 py-3">
          <Segmented<ThemePref>
            value={prefs.theme}
            onChange={(theme) => prefs.setPrefs({ theme })}
            options={[
              { value: "dark", label: <span className="flex items-center justify-center gap-1.5"><Moon className="size-4" /> Dark</span> },
              { value: "light", label: <span className="flex items-center justify-center gap-1.5"><Sun className="size-4" /> Light</span> },
              { value: "system", label: "Auto" },
            ]}
          />
        </div>
        <Row label="Hide amounts" hint="Handy on the bus or in meetings">
          <Switch checked={prefs.hideAmounts} onCheckedChange={(hideAmounts) => prefs.setPrefs({ hideAmounts })} />
        </Row>
      </Section>

      <Section title="Categories" i={2}>
        <div className="grid grid-cols-1">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <CategoryBadge category={c} size="sm" />
              <div className="flex-1 text-[15px]">{c.name}</div>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", c.kind === "income" ? "bg-emerald-soft text-emerald" : "bg-muted text-muted-foreground")}>
                {c.kind === "income" ? "In" : "Out"}
              </span>
              <button onClick={() => removeCategory(c.id)} className="p-1 text-muted-foreground" aria-label={`Delete ${c.name}`}>
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {adding ? (
            <motion.div key="form" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-3 p-4">
                <div className="flex gap-2">
                  <Input className="w-16 text-center text-xl" value={newCat.emoji} onChange={(e) => setNewCat({ ...newCat, emoji: [...e.target.value].slice(-2).join("") })} aria-label="Emoji" />
                  <Input placeholder="Category name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} maxLength={20} />
                </div>
                <Segmented value={newCat.kind} onChange={(kind) => setNewCat({ ...newCat, kind })} options={[{ value: "expense", label: "Money out" }, { value: "income", label: "Money in" }]} />
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={addCategory}>Add</Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button key="btn" onClick={() => setAdding(true)} className="flex w-full items-center gap-2 px-4 py-3.5 text-[15px] font-medium text-emerald">
              <Plus className="size-5" /> New category
            </motion.button>
          )}
        </AnimatePresence>
      </Section>

      <Section title="Your data" i={3}>
        <Row label="Export backup" hint="A JSON file you can keep in Files">
          <Button size="sm" variant="secondary" onClick={doExport}><Download /> Export</Button>
        </Row>
        <Row label="Restore backup" hint="Replaces what's on this device">
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload /> Import</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </Row>
        <Row label="Sample data" hint="Four months of pretend spending">
          <Confirm
            trigger={<Button size="sm" variant="secondary"><Sparkles /> Load</Button>}
            title="Load sample data?"
            body="This replaces everything currently in Ledger with demo data. Export a backup first if you want to keep your entries."
            confirm="Load it"
            onConfirm={async () => {
              await loadSampleData();
              toast.success("Sample data loaded ✨");
              navigate("/");
            }}
          />
        </Row>
        <Row label={<span className="text-coral">Erase everything</span>} hint="Start over with a clean slate">
          <Confirm
            trigger={<Button size="sm" variant="secondary" className="text-coral"><Trash2 /> Erase</Button>}
            title="Erase all data?"
            body="Every transaction, budget and account on this device will be gone for good. There's no cloud copy to restore from."
            confirm="Erase"
            onConfirm={async () => {
              await wipeAll();
              await ensureBasics();
              toast("Fresh start 🌱");
              navigate("/");
            }}
          />
        </Row>
      </Section>

      <Reveal i={4} className="px-5 pt-8 text-center text-[13px] text-muted-foreground">
        <Lock className="mx-auto mb-2 size-5 text-emerald" />
        Everything lives on this device. No accounts, no servers, no tracking.
        <div className="mt-1 opacity-70">Ledger · v1.0</div>
      </Reveal>
    </Page>
  );
}
