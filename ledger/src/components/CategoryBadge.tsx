import type { Category } from "@/db/db";
import { cn } from "@/lib/utils";

/** Emoji in a softly tinted squircle; the tint is the category's chart slot. */
export function CategoryBadge({ category, size = "md", className }: { category?: Category; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = { sm: "size-9 text-lg rounded-xl", md: "size-11 text-xl rounded-2xl", lg: "size-14 text-2xl rounded-[1.1rem]" }[size];
  const color = category ? `var(--series-${category.slot})` : "hsl(var(--muted-foreground))";
  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", dims, className)}
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 28%, transparent)` }}
    >
      <span className="leading-none">{category?.emoji ?? "💸"}</span>
    </div>
  );
}
