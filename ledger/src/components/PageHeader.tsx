import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, action }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="min-w-0">
        {eyebrow && <div className="text-sm font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="truncate text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}
