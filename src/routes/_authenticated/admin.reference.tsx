import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  REF_TABLES,
  adminListRefTable,
  adminUpsertRefRow,
  adminDeleteRefRow,
  type RefTableKey,
} from "@/lib/admin-refdata.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/reference")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin"]);
  },
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const [table, setTable] = useState<RefTableKey>("ref_vehicle_types");
  const meta = REF_TABLES.find((rt) => rt.key === table)!;
  const listFn = useServerFn(adminListRefTable);
  const upsertFn = useServerFn(adminUpsertRefRow);
  const delFn = useServerFn(adminDeleteRefRow);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-ref", table],
    queryFn: () => listFn({ data: { table } }),
  });

  const [draft, setDraft] = useState<Record<string, string>>({
    slug: "",
    label: "",
    label_fr: "",
    label_en: "",
  });

  async function save(row: Record<string, unknown>) {
    try {
      await upsertFn({ data: { table, row } });
      qc.invalidateQueries({ queryKey: ["admin-ref", table] });
      toast.success(t("admin.reference.savedToast"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addRow() {
    const slug = draft.slug.trim().toLowerCase();
    if (!slug) return toast.error(t("admin.reference.slugRequiredError"));
    const row: Record<string, unknown> = { slug, is_active: true };
    if (meta.bilingual) {
      row.label_fr = draft.label_fr || draft.label;
      row.label_en = draft.label_en || null;
    } else {
      row.label = draft.label;
    }
    if (meta.ordered) row.sort_order = 100;
    await save(row);
    setDraft({ slug: "", label: "", label_fr: "", label_en: "" });
  }

  async function remove(slug: string) {
    if (!confirm(t("admin.reference.confirmDelete", { slug }))) return;
    try {
      await delFn({ data: { table, slug } });
      qc.invalidateQueries({ queryKey: ["admin-ref", table] });
      toast.success(t("admin.reference.deletedToast"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="pb-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("admin.reference.heading")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.reference.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Label className="text-xs">{t("admin.reference.tableLabel")}</Label>
          <Select value={table} onValueChange={(v) => setTable(v as RefTableKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REF_TABLES.map((rt) => (
                <SelectItem key={rt.key} value={rt.key}>
                  {rt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/70">
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              placeholder={t("admin.reference.slugPlaceholder")}
              value={draft.slug}
              onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
            />
            {meta.bilingual ? (
              <>
                <Input
                  placeholder={t("admin.reference.labelFrPlaceholder")}
                  value={draft.label_fr}
                  onChange={(e) => setDraft((d) => ({ ...d, label_fr: e.target.value }))}
                />
                <Input
                  placeholder={t("admin.reference.labelEnPlaceholder")}
                  value={draft.label_en}
                  onChange={(e) => setDraft((d) => ({ ...d, label_en: e.target.value }))}
                />
              </>
            ) : (
              <>
                <Input
                  placeholder={t("admin.reference.labelPlaceholder")}
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                />
                <div />
              </>
            )}
            <Button onClick={addRow} className="gap-1">
              <Plus className="h-4 w-4" /> {t("admin.common.add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">{t("admin.reference.columns.slug")}</th>
                  <th className="p-2 text-left">{t("admin.reference.columns.label")}</th>
                  {meta.bilingual && (
                    <th className="p-2 text-left">{t("admin.reference.columns.en")}</th>
                  )}
                  <th className="p-2 text-left">{t("admin.reference.columns.active")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(data?.rows ?? []).map((r: any) => (
                  <tr key={r.slug ?? r.id} className="border-t border-border/60">
                    <td className="p-2 font-mono text-xs">{r.slug ?? r.id}</td>
                    <td className="p-2">
                      <Input
                        defaultValue={meta.bilingual ? (r.label_fr ?? "") : (r.label ?? "")}
                        onBlur={(e) => {
                          const val = e.target.value;
                          const patch: any = { slug: r.slug, is_active: r.is_active }; // eslint-disable-line @typescript-eslint/no-explicit-any
                          if (meta.bilingual) patch.label_fr = val;
                          else patch.label = val;
                          if (meta.ordered) patch.sort_order = r.sort_order ?? 100;
                          if (meta.bilingual) patch.label_en = r.label_en ?? null;
                          save(patch);
                        }}
                      />
                    </td>
                    {meta.bilingual && (
                      <td className="p-2">
                        <Input
                          defaultValue={r.label_en ?? ""}
                          onBlur={(e) =>
                            save({
                              slug: r.slug,
                              is_active: r.is_active,
                              label_fr: r.label_fr,
                              label_en: e.target.value || null,
                            })
                          }
                        />
                      </td>
                    )}
                    <td className="p-2">
                      <Switch
                        checked={!!r.is_active}
                        onCheckedChange={(v) => save({ ...r, is_active: v })}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(r.slug)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(data?.rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      {t("admin.reference.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
