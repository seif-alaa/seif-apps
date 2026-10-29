import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, onCheckedChange, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      onCheckedChange={(v) => {
        haptic("light");
        onCheckedChange?.(v);
      }}
      className={cn(
        "peer inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-accent data-[state=unchecked]:bg-rule-strong",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[22px] rounded-full bg-raised shadow-sm ring-0 transition-transform duration-200 ease-out data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-[18px]" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = "Switch";
