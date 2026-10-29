import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { db } from "@/db/db";
import { useI18n } from "@/i18n";
import { usePrefs } from "@/store/ui";
import { clearNonReal } from "@/db/seed";

/** Sample and simulated data must never pass for real money. */
export function SampleBanner() {
  const { t } = useI18n();
  const sampleMode = usePrefs((s) => s.sampleMode);
  const simulated = useLiveQuery(() => db.transactions.filter((x) => x.origin === "simulated").count(), []) ?? 0;
  if (!sampleMode && !simulated) return null;
  return (
    <div className="mx-5 mt-3 flex items-center gap-3 rounded-sm border border-dashed border-rule-strong px-3 py-2 text-sm">
      <span className="flex-1 text-ink-2">{sampleMode ? t("sample.banner") : t("sample.simBanner", { count: simulated })}</span>
      <button
        className="shrink-0 font-medium text-accent-ink"
        onClick={async () => {
          await clearNonReal();
          toast(t("sample.cleared"));
        }}
      >
        {t("sample.remove")}
      </button>
    </div>
  );
}
