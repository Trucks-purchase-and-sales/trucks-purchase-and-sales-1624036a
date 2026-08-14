import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiOption { value: string; label: string }

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  options: MultiOption[];
  placeholder?: string;
  id?: string;
}

export function MultiSelectBadges({ value, onChange, options, placeholder = "Sélectionner", id }: Props) {
  const [open, setOpen] = React.useState(false);
  const set = new Set(value);
  const toggle = (v: string) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(Array.from(next));
  };
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="w-full justify-between font-normal text-muted-foreground">
            {placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
          <Command>
            <CommandInput placeholder="Rechercher…" />
            <CommandList>
              <CommandEmpty>Aucun résultat</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                    <Check className={cn("mr-2 h-4 w-4", set.has(o.value) ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => {
            const o = options.find((x) => x.value === v);
            return (
              <Badge key={v} variant="secondary" className="gap-1 pl-2">
                {o?.label ?? v}
                <button type="button" onClick={() => toggle(v)} className="rounded-full outline-none focus:ring-1"><X className="h-3 w-3" /></button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
