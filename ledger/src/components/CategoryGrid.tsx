import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Category } from "@/db/db";
import { useI18n } from "@/i18n";
import { categoryName } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, Glyph } from "./icons";
import { CircleHelp } from "lucide-react";

export interface ExtraTile {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** 4-up grid of categories. Tapping a tile is the whole interaction. */
export function CategoryGrid({
  categories,
  suggestedId,
  selectedId,
  extra = [],
  onPick,
}: {
  categories: Category[];
  suggestedId?: string | null;
  selectedId?: string | null;
  extra?: ExtraTile[];
  onPick: (id: string) => void;
}) {
  const { t } = useI18n();
  const tiles = [
    ...categories.map((c) => ({ id: c.id, label: categoryName(c, t), icon: CATEGORY_ICONS[c.icon] ?? CircleHelp })),
    ...extra,
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {tiles.map((tile) => {
        const suggested = tile.id === suggestedId;
        const selected = tile.id === selectedId;
        return (
          <motion.button
            key={tile.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 900, damping: 40 }}
            onClick={() => onPick(tile.id)}
            className={cn(
              "relative flex min-h-[74px] flex-col items-center justify-start gap-1.5 rounded border px-1 pb-2 pt-2.5 text-center",
              selected ? "border-ink bg-sunken" : suggested ? "border-accent bg-accent-wash/60" : "border-transparent bg-sunken/60 hover:bg-sunken",
            )}
          >
            <Glyph icon={tile.icon} size="sm" tone={suggested ? "accent" : "neutral"} className={cn(!suggested && "bg-transparent")} />
            <span className="line-clamp-2 text-xs font-medium leading-tight text-ink-2">{tile.label}</span>
            {suggested && <span className="absolute end-1 top-1 rounded-xs bg-accent px-1 text-[9px] font-semibold uppercase leading-[14px] tracking-wide text-accent-contrast">{t("review.suggested")}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
