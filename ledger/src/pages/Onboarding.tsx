import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { db, uid } from "@/db/db";
import { ensureBasics, loadSampleData } from "@/db/seed";
import { INSTITUTIONS } from "@/engine/institutions";
import { CURRENCIES } from "@/lib/currencies";
import { useI18n } from "@/i18n";
import { usePrefs } from "@/store/ui";
import { cn } from "@/lib/utils";

const QUICK = ["cib", "nbe", "banquemisr", "qnb", "telda", "vodafonecash", "valu", "hsbc"];

/** Three short steps: who you are, where your money lives, done. */
export default function Onboarding() {
  const { t, lang } = useI18n();
  const setPrefs = usePrefs((s) => s.setPrefs);
  const language = usePrefs((s) => s.language);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [picked, setPicked] = useState<Record<string, string>>({});

  async function finish(sample: boolean) {
    if (sample) {
      await loadSampleData();
    } else {
      await ensureBasics();
      const now = Date.now();
      await db.accounts.bulkAdd(
        Object.entries(picked).map(([key, last4], i) => {
          const inst = INSTITUTIONS.find((x) => x.key === key)!;
          return { id: uid(), name: lang === "ar" ? inst.nameAr : inst.name, kind: inst.kind, institution: key, last4: /^\d{4}$/.test(last4) ? last4 : null, currency, startingBalance: 0, archived: false, createdAt: now + i };
        }),
      );
    }
    setPrefs({ name: name.trim(), currency, onboarded: true, sampleMode: sample });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+28px)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex items-center justify-between">
          <span className="text-md font-semibold tracking-tight">Ledger</span>
          <Segmented<"en" | "ar"> size="sm" className="w-36" value={language} onChange={(l) => setPrefs({ language: l })} options={[{ value: "en", label: "EN" }, { value: "ar", label: "ع" }]} />
        </div>
        <div className="mt-2 flex gap-1">
          {[0, 1].map((i) => (
            <span key={i} className={cn("h-0.5 flex-1 rounded-full", i <= step ? "bg-ink" : "bg-rule")} />
          ))}
        </div>

        {step === 0 ? (
          <>
            <h1 className="mt-12 text-[30px] font-semibold leading-[1.15] tracking-tight">{t("onb.title")}</h1>
            <p className="mt-4 text-base leading-relaxed text-ink-2">{t("onb.body")}</p>
            <ul className="mt-6 space-y-2 border-s-2 border-ink ps-4 text-sm text-ink-2">
              <li>{t("onb.p1")}</li>
              <li>{t("onb.p2")}</li>
              <li>{t("onb.p3")}</li>
            </ul>
            <div className="mt-8 space-y-3">
              <Input placeholder={t("onb.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" />
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="mt-auto space-y-2 pt-8">
              <Button size="lg" variant="ink" className="w-full" onClick={() => setStep(1)}>
                {t("common.continue")} <ArrowRight className="rtl:rotate-180" />
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => finish(true)}>
                {t("onb.sample")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-12 text-xl font-semibold">{t("onb.whereTitle")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{t("onb.whereBody")}</p>
            <div className="mt-6 divide-y divide-rule border-y border-rule">
              {QUICK.map((key) => {
                const inst = INSTITUTIONS.find((x) => x.key === key)!;
                const on = key in picked;
                return (
                  <div key={key} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => setPicked((s) => (on ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)) : { ...s, [key]: "" }))}
                      className={cn("flex size-5 items-center justify-center rounded-xs border", on ? "border-ink bg-ink text-paper" : "border-rule-strong")}
                      aria-pressed={on}
                      aria-label={inst.name}
                    >
                      {on && <span className="text-xs">✓</span>}
                    </button>
                    <span className="flex-1 text-base">{lang === "ar" ? inst.nameAr : inst.name}</span>
                    {on && inst.kind !== "wallet" && (
                      <Input className="fig h-9 w-24 text-sm" inputMode="numeric" maxLength={4} placeholder={t("onb.last4")} value={picked[key]} onChange={(e) => setPicked((s) => ({ ...s, [key]: e.target.value.replace(/\D/g, "") }))} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">{t("onb.whereHint")}</p>
            <div className="mt-auto space-y-2 pt-8">
              <Button size="lg" variant="ink" className="w-full" onClick={() => finish(false)}>
                {t("onb.start")}
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => setStep(0)}>
                {t("common.back")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
