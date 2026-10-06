import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-2xl border border-input bg-card/60 px-4 text-base text-foreground placeholder:text-muted-foreground/70 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
