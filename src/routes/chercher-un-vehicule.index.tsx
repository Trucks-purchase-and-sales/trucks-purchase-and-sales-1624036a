import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getStoredRef } from "@/lib/referral";

import { ArrowLeft } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

import { useI18nInit } from "@/i18n/useI18nInit";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";
import { useStepScroll } from "@/hooks/useStepScroll";
import { WizardActionBar } from "@/components/wizard/WizardActionBar";
import { StepProgress } from "@/components/wizard/StepProgress";
import { SearchableCombobox } from "@/components/pickers/SearchableCombobox";
import { YearPicker } from "@/components/pickers/YearPicker";
import { MultiSelectBadges } from "@/components/pickers/MultiSelectBadges";
import { getReferenceData } from "@/lib/reference-data.functions";
import { buyerLeadSchema, type BuyerLeadInput } from "@/lib/buyer-leads.schema";
import { EU27_CODES } from "@/lib/wilmet-constants";
import { AssistantWidget } from "@/components/public/AssistantWidget";

export const Route = createFileRoute("/chercher-un-vehicule/")({
  head: () => ({
    meta: [
      { title: "Chercher un véhicule — Wilmet Trucks" },
      { name: "description", content: "Décrivez votre besoin. Wilmet vérifie ses opportunités disponibles et son réseau pour vous proposer les véhicules les plus pertinents." },
      { property: "og:title", content: "Chercher un véhicule — Wilmet Trucks" },
      { property: "og:description", content: "Décrivez votre besoin. Wilmet vérifie ses opportunités disponibles et son réseau pour vous proposer les véhicules les plus pertinents." },
    ],
  }),
  component: BuyerLeadPage,
});

const STEP_KEYS = ["vehicle", "technical", "budget", "contact"] as const;

function BuyerLeadPage() {
  useI18nInit();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fn = useServerFn(getReferenceData);
  const { data: ref } = useQuery({ queryKey: ["reference-data"], queryFn: () => fn() });

  const [step, setStep] = useState(0);
  const containerRef = useStepScroll(step);

  const form = useForm<BuyerLeadInput>({
    resolver: zodResolver(buyerLeadSchema) as Resolver<BuyerLeadInput>,
    mode: "onBlur",
    defaultValues: {
      vehicle_category: "", vehicle_type: "", currency: "EUR", gdpr_consent: false as unknown as true,
      required_equipment: [], wanted_equipment: [], locale: i18n.language || "fr",
    },
  });

  const stepFields: (keyof BuyerLeadInput)[][] = [
    ["vehicle_category", "vehicle_type"],
    [],
    [],
    ["first_name", "last_name", "email", "gdpr_consent"],
  ];

  const next = async () => {
    const ok = await form.trigger(stepFields[step] as (keyof BuyerLeadInput)[]);
    if (!ok) return;
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const [submitting, setSubmitting] = useState(false);
  const onSubmit = form.handleSubmit(
    async (data) => {
      setSubmitting(true);
      try {
        const r = await fetch("/api/public/buyer-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            locale: i18n.language || "fr",
            referral_code: getStoredRef() ?? "",
          }),

        });
        if (!r.ok) throw new Error(String(r.status));
        const body = (await r.json()) as { id: string; reference: string };
        navigate({ to: "/chercher-un-vehicule/merci", search: { ref: body.reference } as never });
      } catch (e) {
        console.error(e);
        toast.error(t("buyer.errors.submit"));
      } finally { setSubmitting(false); }
    },
    (errors) => {
      // Surface validation errors so the form never silently no-ops (F35).
      const fieldOrder: (keyof BuyerLeadInput)[] = [
        "vehicle_category", "vehicle_type", "first_name", "last_name", "email", "gdpr_consent",
      ];
      const firstBadStep = STEP_KEYS.findIndex((_, i) =>
        stepFields[i].some((f) => (errors as Record<string, unknown>)[f as string]),
      );
      if (firstBadStep >= 0 && firstBadStep !== step) setStep(firstBadStep);
      const firstField = fieldOrder.find((f) => (errors as Record<string, unknown>)[f as string])
        ?? (Object.keys(errors)[0] as keyof BuyerLeadInput | undefined);
      const labelMap: Record<string, string> = {
        vehicle_category: t("buyer.fields.vehicleCategory", { defaultValue: "Catégorie de véhicule" }),
        vehicle_type: t("buyer.fields.vehicleType"),
        first_name: t("buyer.fields.firstName", { defaultValue: "Prénom" }),
        last_name: t("buyer.fields.lastName", { defaultValue: "Nom" }),
        email: "Email",
        gdpr_consent: t("buyer.fields.gdpr", { defaultValue: "Consentement RGPD" }),
      };
      const label = firstField ? labelMap[firstField as string] ?? String(firstField) : "";
      toast.error(
        t("buyer.errors.validation", { defaultValue: "Merci de compléter les champs requis." }),
        label ? { description: `${t("common.field", { defaultValue: "Champ" })} : ${label}` } : undefined,
      );
    },
  );

  const labels = STEP_KEYS.map((k) => t(`buyer.steps.${k}`));

  // Countries: EU-27 only, no default value (same referential as the seller form).
  const countryOptions = useMemo(
    () => (ref?.countries ?? [])
      .filter((c) => EU27_CODES.has(c.code))
      .map((c) => ({ value: c.code, label: (i18n.language === "fr" ? c.name_fr : c.name_en) || c.name_fr })),
    [ref, i18n.language],
  );

  const category = form.watch("vehicle_category");
  const vehicleType = form.watch("vehicle_type");

  const categoryOptions = useMemo(
    () => (ref?.vehicleCategories ?? []).map((c) => ({ value: c.slug, label: (i18n.language === "fr" ? c.label_fr : c.label_en) || c.label_fr })),
    [ref, i18n.language],
  );

  // Brands are filtered by the chosen category (same mapping as the seller form).
  const brandOptions = useMemo(() => {
    const all = ref?.brands ?? [];
    if (!category) return all.map((b) => ({ value: b.slug, label: b.label }));
    const allowed = new Set(
      (ref?.categoryBrands ?? []).filter((cb) => cb.category_slug === category).map((cb) => cb.brand_slug),
    );
    const filtered = allowed.size > 0 ? all.filter((b) => allowed.has(b.slug)) : all;
    return filtered.map((b) => ({ value: b.slug, label: b.label }));
  }, [ref, category]);

  const brandSlug = form.watch("preferred_brand");
  const modelOptions = useMemo(
    () => (ref?.models ?? []).filter((m) => m.brand_slug === brandSlug).map((m) => ({ value: m.label, label: m.label })),
    [ref, brandSlug],
  );

  // Body types are filtered by the selected vehicle type (applies_to), like the seller side.
  const bodyTypeOptions = useMemo(
    () => (ref?.bodyTypes ?? [])
      .filter((b) => !vehicleType || !b.applies_to || (b.applies_to as string[]).includes(vehicleType))
      .map((v) => ({ value: v.slug, label: (i18n.language === "fr" ? v.label_fr : v.label_en) || v.label_fr })),
    [ref, vehicleType, i18n.language],
  );

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
          <h1 tabIndex={-1} data-step-title className="text-3xl font-extrabold tracking-tight sm:text-4xl outline-none">
            {t("buyer.title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("buyer.subtitle")}
          </p>

          <div className="mt-6"><StepProgress step={step} total={STEP_KEYS.length} labels={labels} /></div>

          <Card ref={containerRef} className="mt-6 border-border/70">
            <CardContent className="p-5 sm:p-8">
              <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                {step === 0 && (
                  <div className="space-y-4">
                    <Field label={t("buyer.fields.vehicleCategory", { defaultValue: "Catégorie de véhicule" })} error={form.formState.errors.vehicle_category?.message} required>
                      <Controller name="vehicle_category" control={form.control} render={({ field }) => (
                        <SearchableCombobox
                          value={field.value || undefined}
                          onChange={(v) => { field.onChange(v); form.setValue("preferred_brand", ""); form.setValue("preferred_model", ""); }}
                          options={categoryOptions}
                          placeholder={t("common.select")}
                        />
                      )} />
                    </Field>
                    <Field label={t("buyer.fields.vehicleType")} error={form.formState.errors.vehicle_type?.message} required>
                      <Controller name="vehicle_type" control={form.control} render={({ field }) => (
                        <SearchableCombobox
                          value={field.value || undefined}
                          onChange={(v) => { field.onChange(v); form.setValue("body_type", ""); }}
                          options={(ref?.vehicleTypes ?? []).map((v) => ({ value: v.slug, label: (i18n.language === "fr" ? v.label_fr : v.label_en) || v.label_fr }))}
                          placeholder={t("common.select")}
                        />
                      )} />
                    </Field>
                    <Field label={t("buyer.fields.bodyType")}>
                      <Controller name="body_type" control={form.control} render={({ field }) => (
                        <SearchableCombobox value={field.value || undefined} onChange={field.onChange}
                          options={bodyTypeOptions}
                          placeholder={t("common.select")} />
                      )} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("buyer.fields.brandOpt")}>
                        <Controller name="preferred_brand" control={form.control} render={({ field }) => (
                          <SearchableCombobox value={field.value || undefined} onChange={(v) => { field.onChange(v); form.setValue("preferred_model", ""); }}
                            options={brandOptions}
                            placeholder={category ? t("common.select") : t("buyer.fields.pickCategoryFirst", { defaultValue: "Sélectionnez d'abord une catégorie" })} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.modelOpt")}>
                        <Controller name="preferred_model" control={form.control} render={({ field }) => (
                          modelOptions.length > 0
                            ? <SearchableCombobox value={field.value || undefined} onChange={field.onChange} options={modelOptions} placeholder={t("common.select")} />
                            : <Input {...field} value={field.value ?? ""} placeholder={t("common.other")} />
                        )} />
                      </Field>
                    </div>
                    <Field label={t("buyer.fields.intendedUse")}>
                      <Input {...form.register("intended_use")} />
                    </Field>
                    <Field label={t("buyer.fields.usageCountry")}>
                      <Controller name="usage_country" control={form.control} render={({ field }) => (
                        <SearchableCombobox value={field.value || undefined} onChange={field.onChange} options={countryOptions} placeholder={t("common.select")} />
                      )} />
                    </Field>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("buyer.fields.minYear")}>
                        <Controller name="min_year" control={form.control} render={({ field }) => (
                          <YearPicker value={field.value ?? undefined} onChange={(v) => field.onChange(v ?? null)} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.maxMileage")}>
                        <Input inputMode="numeric" type="number" min={0} step={1000} {...form.register("max_mileage", { valueAsNumber: true, setValueAs: (v) => (v === "" || Number.isNaN(v) ? null : Number(v)) })} />
                      </Field>
                      <Field label={t("buyer.fields.minEuro")}>
                        <Controller name="min_euro_norm" control={form.control} render={({ field }) => (
                          <SearchableCombobox value={field.value || undefined} onChange={field.onChange}
                            options={(ref?.euroStandards ?? []).map((e) => ({ value: e.slug, label: e.label }))} placeholder={t("common.select")} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.fuel")}>
                        <Controller name="fuel_type" control={form.control} render={({ field }) => (
                          <SearchableCombobox value={field.value || undefined} onChange={field.onChange}
                            options={(ref?.fuelTypes ?? []).map((v) => ({ value: v.slug, label: (i18n.language === "fr" ? v.label_fr : v.label_en) || v.label_fr }))} placeholder={t("common.select")} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.gearbox")}>
                        <Controller name="gearbox" control={form.control} render={({ field }) => (
                          <SearchableCombobox value={field.value || undefined} onChange={field.onChange}
                            options={(ref?.gearboxTypes ?? []).map((v) => ({ value: v.slug, label: (i18n.language === "fr" ? v.label_fr : v.label_en) || v.label_fr }))} placeholder={t("common.select")} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.ptac")}>
                        <Input inputMode="numeric" type="number" min={0} {...form.register("ptac_kg", { valueAsNumber: true, setValueAs: (v) => (v === "" || Number.isNaN(v) ? null : Number(v)) })} />
                      </Field>
                      <Field label={t("buyer.fields.payload")}>
                        <Input inputMode="numeric" type="number" min={0} {...form.register("payload_kg", { valueAsNumber: true, setValueAs: (v) => (v === "" || Number.isNaN(v) ? null : Number(v)) })} />
                      </Field>
                    </div>
                    <Field label={t("buyer.fields.requiredEquipment")}>
                      <Controller name="required_equipment" control={form.control} render={({ field }) => (
                        <MultiSelectBadges value={field.value ?? []} onChange={field.onChange}
                          options={(ref?.equipment ?? []).map((e) => ({ value: e.slug, label: (i18n.language === "fr" ? e.label_fr : e.label_en) || e.label_fr }))} />
                      )} />
                    </Field>
                    <Field label={t("buyer.fields.wantedEquipment")}>
                      <Controller name="wanted_equipment" control={form.control} render={({ field }) => (
                        <MultiSelectBadges value={field.value ?? []} onChange={field.onChange}
                          options={(ref?.equipment ?? []).map((e) => ({ value: e.slug, label: (i18n.language === "fr" ? e.label_fr : e.label_en) || e.label_fr }))} />
                      )} />
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <Field label={t("buyer.fields.maxBudget")}>
                          <Input inputMode="decimal" type="number" min={0} step={100} {...form.register("max_budget_ht", { valueAsNumber: true, setValueAs: (v) => (v === "" || Number.isNaN(v) ? null : Number(v)) })} />
                        </Field>
                      </div>
                      <Field label={t("buyer.fields.currency")}>
                        <Controller name="currency" control={form.control} render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                              <SelectItem value="GBP">GBP (£)</SelectItem>
                              <SelectItem value="USD">USD ($)</SelectItem>
                            </SelectContent>
                          </Select>
                        )} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label={t("buyer.fields.budgetFlexible")}>
                        <Controller name="budget_flexible" control={form.control} render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="oui">{t("buyer.choices.flexOui")}</SelectItem>
                              <SelectItem value="non">{t("buyer.choices.flexNon")}</SelectItem>
                              <SelectItem value="selon_opportunite">{t("buyer.choices.flexOpp")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.timeline")}>
                        <Controller name="buy_timeline" control={form.control} render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="immediat">{t("buyer.choices.tImmediat")}</SelectItem>
                              <SelectItem value="sous_7j">{t("buyer.choices.t7j")}</SelectItem>
                              <SelectItem value="sous_30j">{t("buyer.choices.t30j")}</SelectItem>
                              <SelectItem value="sous_3m">{t("buyer.choices.t3m")}</SelectItem>
                              <SelectItem value="projet_futur">{t("buyer.choices.tFutur")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.financing")}>
                        <Controller name="financing_needed" control={form.control} render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="oui">{t("buyer.choices.finOui")}</SelectItem>
                              <SelectItem value="non">{t("buyer.choices.finNon")}</SelectItem>
                              <SelectItem value="a_discuter">{t("buyer.choices.finDiscuss")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )} />
                      </Field>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("buyer.fields.firstName")} required error={form.formState.errors.first_name?.message}>
                        <Input autoComplete="given-name" {...form.register("first_name")} />
                      </Field>
                      <Field label={t("buyer.fields.lastName")} required error={form.formState.errors.last_name?.message}>
                        <Input autoComplete="family-name" {...form.register("last_name")} />
                      </Field>
                    </div>
                    <Field label={t("buyer.fields.company")}>
                      <Input autoComplete="organization" {...form.register("company_name")} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("buyer.fields.email")} required error={form.formState.errors.email?.message}>
                        <Input inputMode="email" type="email" autoComplete="email" {...form.register("email")} />
                      </Field>
                      <Field label={t("buyer.fields.phone")}>
                        <Input inputMode="tel" type="tel" autoComplete="tel" {...form.register("phone")} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("buyer.fields.country")}>
                        <Controller name="country" control={form.control} render={({ field }) => (
                          <SearchableCombobox value={field.value || undefined} onChange={field.onChange} options={countryOptions} placeholder={t("common.select")} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.city")}>
                        <Input autoComplete="address-level2" {...form.register("city")} />
                      </Field>
                    </div>
                    <Field label={t("buyer.fields.message")}>
                      <Textarea rows={4} {...form.register("message")} />
                    </Field>
                    <Controller name="gdpr_consent" control={form.control} render={({ field }) => (
                      <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                        <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                        <span className="leading-snug text-muted-foreground">{t("buyer.fields.gdpr")}</span>
                      </label>
                    )} />
                    {form.formState.errors.gdpr_consent && (
                      <p className="text-xs text-destructive">{t("buyer.errors.required")}</p>
                    )}
                    {/* Honeypot — hidden from real users, bots fill it and are silently dropped server-side */}
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", opacity: 0 }}
                      {...form.register("website" as never)}
                    />
                  </div>
                )}
              </form>
              <div className="mt-6">
                <WizardActionBar
                  step={step}
                  total={STEP_KEYS.length}
                  onBack={back}
                  onNext={next}
                  onSubmit={onSubmit}
                  submitting={submitting}
                  backLabel={t("buyer.actions.back")}
                  nextLabel={t("buyer.actions.next")}
                  submitLabel={t("buyer.actions.submit")}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <AssistantWidget />
    </div>
  );
}

function Field({ label, children, required, error }: { label: string; children: React.ReactNode; required?: boolean; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center"><img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-9 w-auto" /></Link>
        <LanguageSwitcher compact />
      </div>
    </header>
  );
}
