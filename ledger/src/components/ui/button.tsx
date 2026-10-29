import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-contrast hover:bg-accent/90",
        ink: "bg-ink text-paper hover:bg-ink/90",
        secondary: "bg-sunken text-ink hover:bg-rule",
        outline: "border border-rule-strong bg-transparent text-ink hover:bg-sunken",
        ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
        danger: "bg-neg-wash text-neg hover:bg-neg-wash/80",
        link: "h-auto px-0 text-accent-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 rounded px-4 text-base",
        sm: "h-8 rounded-sm px-3 text-sm",
        lg: "h-12 rounded-md px-5 text-base",
        icon: "size-10 rounded",
        "icon-sm": "size-8 rounded-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref">, VariantProps<typeof buttonVariants> {
  noHaptic?: boolean;
}

/** Press feedback is a short, firm scale — tactile without being bouncy. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, noHaptic, onClick, type = "button", ...props }, ref) => (
  <motion.button
    ref={ref}
    type={type}
    whileTap={{ scale: 0.97 }}
    transition={{ type: "spring", stiffness: 900, damping: 40 }}
    className={cn(buttonVariants({ variant, size, className }))}
    onClick={(e) => {
      if (!noHaptic) haptic("light");
      onClick?.(e);
    }}
    {...props}
  />
));
Button.displayName = "Button";

export { buttonVariants };
