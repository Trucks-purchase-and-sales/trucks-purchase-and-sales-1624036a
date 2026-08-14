import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_LOCALES } from "@/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "fr").split("-")[0];

  return (
    <Select value={current} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger className={compact ? "h-8 w-[110px] gap-1 text-xs" : "h-9 w-[140px] gap-1 text-sm"}>
        <Globe className="h-3.5 w-3.5 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
