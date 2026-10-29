import * as React from "react";
import * as A from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export const AlertDialog = A.Root;
export const AlertDialogTrigger = A.Trigger;

export function AlertDialogContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof A.Content>) {
  return (
    <A.Portal>
      <A.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <A.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg bg-raised p-5 shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
          className,
        )}
        {...props}
      >
        {children}
      </A.Content>
    </A.Portal>
  );
}
export const AlertDialogTitle = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof A.Title>) => <A.Title className={cn("text-md font-semibold", className)} {...p} />;
export const AlertDialogDescription = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof A.Description>) => <A.Description className={cn("text-sm leading-relaxed text-ink-2", className)} {...p} />;
export const AlertDialogAction = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof A.Action>) => <A.Action className={cn(buttonVariants({ variant: "danger" }), className)} {...p} />;
export const AlertDialogCancel = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof A.Cancel>) => <A.Cancel className={cn(buttonVariants({ variant: "secondary" }), className)} {...p} />;
