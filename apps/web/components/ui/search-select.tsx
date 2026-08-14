"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export type SearchSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export function filterSearchSelectOptions(
  options: SearchSelectOption[],
  query: string
): SearchSelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return options;
  }
  return options.filter((option) => {
    const haystack = `${option.label} ${option.value} ${option.hint ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

type SearchSelectProps = {
  label: string;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
};

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  disabled,
  loading
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => filterSearchSelectOptions(options, query), [options, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    searchRef.current?.focus();
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="text-[11px] font-medium text-zinc-700">{label}</div>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "mt-1 flex w-full items-center justify-between rounded-md border border-border bg-white px-2 py-1.5 text-left text-sm",
          disabled ? "opacity-60" : ""
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected || value ? "truncate text-zinc-800" : "text-muted-foreground"}>
          {selected ? (
            <>
              {selected.label}
              <span className="ml-1 font-mono text-[11px] text-zinc-500">{selected.value}</span>
            </>
          ) : value ? (
            <span className="font-mono">{value}</span>
          ) : (
            placeholder
          )}
        </span>
        <span className="ml-2 text-[10px] text-muted-foreground">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-white p-1 shadow-sm">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded border border-border px-2 py-1 text-xs"
            aria-controls={listId}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const first = filtered[0];
                if (first) {
                  pick(first.value);
                }
              }
            }}
          />
          <ul id={listId} role="listbox" className="mt-1 max-h-40 overflow-y-auto text-xs">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={cn(
                  "w-full rounded px-2 py-1 text-left text-muted-foreground hover:bg-zinc-100",
                  !value ? "bg-zinc-50" : ""
                )}
                onClick={() => pick("")}
              >
                —
              </button>
            </li>
            {loading ? (
              <li className="px-2 py-1 text-muted-foreground">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-1 text-muted-foreground">{emptyText}</li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={cn(
                      "w-full rounded px-2 py-1 text-left hover:bg-zinc-100",
                      option.value === value ? "bg-zinc-50" : ""
                    )}
                    onClick={() => pick(option.value)}
                  >
                    <div className="truncate text-zinc-800">{option.label}</div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      {option.value}
                      {option.hint ? ` · ${option.hint}` : ""}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
