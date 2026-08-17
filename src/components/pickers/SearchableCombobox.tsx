import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  group?: string;
}

interface Props {
  value: string | undefined;
  onChange: (v: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /**
   * Creatable mode: the typed text can be committed as-is when the catalog does
   * not contain it yet (brand/model referentials are never exhaustive).
   * Opt-in, so every existing usage keeps its strict-list behaviour.
   */
  allowCustom?: boolean;
  /** Label of the "create" row; receives the current query. */
  customLabel?: (query: string) => string;
}

export function SearchableCombobox({
  value, onChange, options, placeholder = "Sélectionner",
  searchPlaceholder = "Rechercher…", emptyLabel = "Aucun résultat", disabled, id, className,
  allowCustom = false, customLabel = (q) => `Utiliser « ${q} »`,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = options.find((o) => o.value === value);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ComboboxOption[]>();
    for (const o of options) {
      const g = o.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return Array.from(map.entries());
  }, [options]);

  const trimmed = query.trim();
  const showCustom =
    allowCustom &&
    trimmed.length > 0 &&
    !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected?.label ?? value ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {!showCustom && <CommandEmpty>{emptyLabel}</CommandEmpty>}
            {grouped.map(([g, opts]) => (
              <CommandGroup key={g} heading={g || undefined}>
                {opts.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.value}`}
                    onSelect={() => commit(o.value)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {showCustom && (
              <CommandGroup>
                <CommandItem value={`__custom__${trimmed}`} onSelect={() => commit(trimmed)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {customLabel(trimmed)}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
