import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

const sizeClass = {
  xs: "px-2.5 py-1 text-xs",
  sm: "px-3 py-1.5 text-xs",
  md: "px-3 py-1.5 text-sm"
} as const;

type Size = keyof typeof sizeClass;

type CommonProps = {
  children: ReactNode;
  className?: string;
  size?: Size;
  active?: boolean;
  tone?: "default" | "primary" | "accent" | "danger" | "workflow";
};

function toneClass(tone: CommonProps["tone"], active?: boolean): string {
  if (active) {
    return "border-teal-700 bg-teal-50 text-teal-900";
  }
  switch (tone) {
    case "primary":
      return "border-transparent bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60";
    case "accent":
      return "border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-60";
    case "workflow":
      return "border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 disabled:opacity-60";
    case "danger":
      return "border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-60";
    default:
      return "border-border bg-white hover:bg-muted disabled:opacity-60";
  }
}

export function GhostButton({
  children,
  className,
  size = "sm",
  active,
  tone = "default",
  type = "button",
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn("inline-flex items-center justify-center rounded-md border font-medium", sizeClass[size], toneClass(tone, active), className)}
      {...props}
    >
      {children}
    </button>
  );
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
    <Link
      href={href}
      className={cn("inline-flex items-center justify-center rounded-md border font-medium", sizeClass[size], toneClass(tone, active), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
