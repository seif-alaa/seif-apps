import { Share, X } from "lucide-react";
import { useState } from "react";
import { isIOS, isStandalone } from "@/lib/pwa";
import { usePrefs } from "@/store/ui";
import { useI18n } from "@/i18n";

export function InstallHint() {
  const { t } = useI18n();
  const dismissed = usePrefs((s) => s.installHintDismissed);
  const setPrefs = usePrefs((s) => s.setPrefs);
  const [show] = useState(() => isIOS() && !isStandalone());
  if (!show || dismissed) return null;
  return (
    <div className="mx-5 mt-3 flex items-start gap-3 rounded-sm border border-rule bg-surface px-3 py-2.5 text-sm">
      <Share className="mt-0.5 size-4 shrink-0 text-accent-ink" />
      <span className="flex-1 text-ink-2">{t("install.hint")}</span>
      <button aria-label={t("common.close")} onClick={() => setPrefs({ installHintDismissed: true })} className="text-ink-3">
        <X className="size-4" />
      </button>
    </div>
  );
}
