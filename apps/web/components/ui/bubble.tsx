import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="bubble-group" className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />;
}

const bubbleVariants = cva("group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end", {
  variants: {
    variant: {
      default: "",
      secondary: "",
      muted: "",
      outline: "",
      ghost: ""
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bubbleVariants> & { align?: "start" | "end" }) {
  return (
    <div data-slot="bubble" data-variant={variant} data-align={align} className={cn(bubbleVariants({ variant }), className)} {...props} />
  );
}

function BubbleContent({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="bubble-content"
      className={cn(
        "w-fit max-w-full min-w-0 overflow-hidden rounded-xl border px-3 py-2 text-sm leading-relaxed break-words",
        "group-data-[variant=default]/bubble:border-transparent group-data-[variant=default]/bubble:bg-primary group-data-[variant=default]/bubble:text-primary-foreground",
        "group-data-[variant=secondary]/bubble:border-transparent group-data-[variant=secondary]/bubble:bg-secondary group-data-[variant=secondary]/bubble:text-secondary-foreground",
        "group-data-[variant=muted]/bubble:border-transparent group-data-[variant=muted]/bubble:bg-muted group-data-[variant=muted]/bubble:text-foreground",
        "group-data-[variant=outline]/bubble:border-border group-data-[variant=outline]/bubble:bg-background",
        "group-data-[variant=ghost]/bubble:border-transparent group-data-[variant=ghost]/bubble:bg-transparent group-data-[variant=ghost]/bubble:p-0",
        className
      )}
      {...props}
    />
  );
}

export { BubbleGroup, Bubble, BubbleContent, bubbleVariants };
