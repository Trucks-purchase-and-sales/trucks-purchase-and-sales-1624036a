import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  from?: number;
  to?: number;
  placeholder?: string;
  id?: string;
}

export function YearPicker({ value, onChange, from = 1980, to = new Date().getFullYear() + 1, placeholder = "Année", id }: Props) {
  const years = React.useMemo(() => {
    const out: number[] = [];
    for (let y = to; y >= from; y--) out.push(y);
    return out;
  }, [from, to]);

  return (
    <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(v ? Number(v) : undefined)}>
      <SelectTrigger id={id}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-72">
        {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
