import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { Button, type ButtonProps } from "./button";

type Size = "xs" | "sm" | "md";
type Tone = "default" | "primary" | "accent" | "danger" | "workflow";

type CommonProps = {
  children: ReactNode;
  className?: string;
  size?: Size;
  active?: boolean;
  tone?: Tone;
};

function mapVariant(tone: Tone | undefined, active?: boolean): ButtonProps["variant"] {
  if (active) {
    return "default";
  }
  switch (tone) {
    case "primary":
      return "default";
    case "accent":
      return "accent";
    case "workflow":
      return "workflow";
    case "danger":
      return "danger";
    default:
      return "outline";
  }
}

function mapSize(size: Size | undefined): ButtonProps["size"] {
  if (size === "md") {
    return "default";
  }
  return size ?? "sm";
}

export function ToolbarLink({
  href,
  children,
  className,
  size = "sm",
  active,
  tone = "default",
  ...props
}: CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children" | "className">) {
  return (
    <Button asChild variant={mapVariant(tone, active)} size={mapSize(size)} className={className}>
      <Link href={href} {...props}>
        {children}
      </Link>
    </Button>
  );
}
