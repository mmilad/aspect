"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

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
  const selected = options.find((option) => option.value === value);

  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-8 w-full justify-between px-2 font-normal"
          >
            <span className={cn("truncate", selected || value ? "text-foreground" : "text-muted-foreground")}>
              {selected ? (
                <>
                  {selected.label}
                  <span className="ml-1 font-mono text-[11px] text-muted-foreground">{selected.value}</span>
                </>
              ) : value ? (
                <span className="font-mono">{value}</span>
              ) : (
                placeholder
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>{loading ? "Loading…" : emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">—</span>
                </CommandItem>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value} ${option.hint ?? ""}`}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{option.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {option.value}
                        {option.hint ? ` · ${option.hint}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
