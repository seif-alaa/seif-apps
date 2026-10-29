import {
  ArrowLeftRight, Baby, Banknote, BookOpen, BriefcaseBusiness, Car, CircleDashed, CircleHelp, Coffee, CreditCard, Dumbbell, Gift, GraduationCap,
  HeartPulse, House, Landmark, Laptop, PawPrint, Percent, Plane, ReceiptText, Scale, Shirt, ShoppingBag, ShoppingBasket, Smartphone, Tag, Ticket,
  TrendingUp, Undo2, UtensilsCrossed, Wallet, Wrench, type LucideIcon,
} from "lucide-react";
import type { Account, Category, Transaction } from "@/db/db";
import { institution } from "@/engine/institutions";
import { cn } from "@/lib/utils";

/**
 * One icon family (Lucide, 1.75 stroke) inside one geometry: a 32px square with
 * a 8px radius on a sunken fill. Category identity comes from the glyph and its
 * label — never from colour alone.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  basket: ShoppingBasket, utensils: UtensilsCrossed, coffee: Coffee, car: Car, receipt: ReceiptText, bag: ShoppingBag, ticket: Ticket, pulse: HeartPulse,
  book: BookOpen, percent: Percent, dot: CircleDashed, briefcase: BriefcaseBusiness, laptop: Laptop, gift: Gift, trend: TrendingUp, tag: Tag, home: House,
  plane: Plane, baby: Baby, paw: PawPrint, dumbbell: Dumbbell, phone: Smartphone, shirt: Shirt, wrench: Wrench, graduation: GraduationCap,
};
export const ICON_CHOICES = Object.keys(CATEGORY_ICONS);

const SIZES = { sm: "size-7 rounded-sm [&_svg]:size-[15px]", md: "size-9 rounded [&_svg]:size-[18px]", lg: "size-11 rounded-md [&_svg]:size-5" };

export function Glyph({ icon: Icon, size = "md", tone = "neutral", className }: { icon: LucideIcon; size?: keyof typeof SIZES; tone?: "neutral" | "accent" | "pos" | "warn" | "neg"; className?: string }) {
  const tones = {
    neutral: "bg-sunken text-ink-2",
    accent: "bg-accent-wash text-accent-ink",
    pos: "bg-pos-wash text-pos",
    warn: "bg-warn-wash text-warn",
    neg: "bg-neg-wash text-neg",
  };
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], tones[tone], className)}>
      <Icon strokeWidth={1.75} />
    </span>
  );
}

export function CategoryGlyph({ category, size }: { category?: Category | null; size?: keyof typeof SIZES }) {
  return <Glyph icon={(category && CATEGORY_ICONS[category.icon]) || CircleHelp} size={size} />;
}

/** The glyph for a transaction row: transfers, refunds and unknowns get their own marks. */
export function TxnGlyph({ t, category, size }: { t: Transaction; category?: Category | null; size?: keyof typeof SIZES }) {
  if (t.kind === "transfer") return <Glyph icon={ArrowLeftRight} size={size} />;
  if (t.kind === "refund") return <Glyph icon={Undo2} size={size} tone="pos" />;
  if (t.kind === "adjustment") return <Glyph icon={Scale} size={size} />;
  if (t.kind === "unknown" || !category) return <Glyph icon={CircleHelp} size={size} tone="accent" />;
  return <CategoryGlyph category={category} size={size} />;
}

const ACCOUNT_ICON: Record<Account["kind"], LucideIcon> = { bank: Landmark, card: CreditCard, credit: CreditCard, wallet: Wallet, cash: Banknote, other: Landmark };

/** Institution monogram (CIB, NBE, T…) set in mono caps; falls back to an account-type icon. */
export function AccountMark({ account, size = "md" }: { account?: Account | null; size?: "sm" | "md" }) {
  const inst = institution(account?.institution);
  const dims = size === "sm" ? "size-7 rounded-sm text-[9px] [&_svg]:size-[14px]" : "size-9 rounded text-[10px] [&_svg]:size-[17px]";
  if (!account || !inst.mark) {
    const Icon = ACCOUNT_ICON[account?.kind ?? "other"];
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center border border-rule-strong text-ink-2", dims)}>
        <Icon strokeWidth={1.75} />
      </span>
    );
  }
  return <span className={cn("inline-flex shrink-0 items-center justify-center bg-ink font-mono font-semibold tracking-tight text-paper", dims)}>{inst.mark}</span>;
}
