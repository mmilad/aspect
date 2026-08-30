"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

function MessageScrollerProvider({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-scroller-provider" className={cn("flex h-full min-h-0 flex-col", className)} {...props} />;
}

function MessageScroller({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-scroller"
      className={cn("relative flex size-full min-h-0 flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

function MessageScrollerViewport({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <ScrollArea className={cn("h-full", className)}>{children}</ScrollArea>;
}

function MessageScrollerContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-scroller-content"
      className={cn("mx-auto flex w-full max-w-3xl flex-col gap-4 p-4", className)}
      {...props}
    />
  );
}

function MessageScrollerItem({
  className,
  messageId,
  scrollAnchor,
  ...props
}: React.ComponentProps<"div"> & { messageId?: string; scrollAnchor?: boolean }) {
  return (
    <div
      data-slot="message-scroller-item"
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor ? "true" : undefined}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    />
  );
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem
};
