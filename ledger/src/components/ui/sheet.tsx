import * as React from "react";
import { Drawer as D } from "vaul";
import { cn } from "@/lib/utils";

/** Bottom sheet: drag to dismiss, scales the app slightly behind it. */
export function Sheet({ open, onOpenChange, children, dismissible = true }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode; dismissible?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground dismissible={dismissible} repositionInputs={false}>
      {children}
    </D.Root>
  );
}

export const SheetContent = React.forwardRef<React.ElementRef<typeof D.Content>, React.ComponentPropsWithoutRef<typeof D.Content> & { title: string; description?: string; hideTitle?: boolean }>(
  ({ className, children, title, description, hideTitle, ...props }, ref) => (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content
        ref={ref}
        className={cn("fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] max-w-[560px] flex-col rounded-t-sheet bg-raised pb-safe text-ink shadow-sheet outline-none", className)}
        {...props}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-rule-strong" aria-hidden />
        <D.Title className={cn("px-5 pt-3 text-md font-semibold", hideTitle && "sr-only")}>{title}</D.Title>
        {description ? <D.Description className={cn("px-5 text-sm text-ink-3", hideTitle && "sr-only")}>{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
        {children}
      </D.Content>
    </D.Portal>
  ),
);
SheetContent.displayName = "SheetContent";
