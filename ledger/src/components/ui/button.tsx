import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-glow hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        outline: "border border-border bg-card/40 hover:bg-accent",
        destructive: "bg-coral text-primary-foreground hover:bg-coral/90",
        soft: "bg-emerald-soft text-emerald hover:bg-emerald-soft/80",
      },
      size: {
        default: "h-12 rounded-2xl px-5 text-[15px]",
        sm: "h-9 rounded-xl px-3.5 text-sm",
        lg: "h-14 rounded-2xl px-6 text-base",
        icon: "size-11 rounded-2xl",
        "icon-sm": "size-9 rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref">, VariantProps<typeof buttonVariants> {
  noHaptic?: boolean;
}

/** Every button gets a springy press and a light haptic tap. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, noHaptic, onClick, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={(e) => {
        if (!noHaptic) haptic("light");
        onClick?.(e);
      }}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
