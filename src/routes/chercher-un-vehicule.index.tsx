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
import { submitBuyerLeadAuthenticated } from "@/lib/buyer-leads.functions";
import { buyerLeadSchema, BUYER_FIELD_LABELS, type BuyerLeadInput } from "@/lib/buyer-leads.schema";
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
  const { data: ref, isLoading: refLoading, isError: refError, refetch: refRefetch } =
    useQuery({ queryKey: ["reference-data"], queryFn: () => fn() });

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

  // Explicit auth state. Until it resolves we NEVER guess: submitting as
  // anonymous while a session exists is exactly the silent downgrade we fix.
  type AuthState =
    | { status: "loading" }
    | { status: "anonymous" }
    | { status: "authenticated"; userId: string; email: string | null; partnerKind: string | null };
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (cancelled) return;
      if (!user) { setAuth({ status: "anonymous" }); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, company_name, email, phone, country, city, partner_kind")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setAuth({
        status: "authenticated",
        userId: user.id,
        email: profile?.email ?? user.email ?? null,
        partnerKind: profile?.partner_kind ?? null,
      });
      if (!profile) return;
      const fill = (key: keyof BuyerLeadInput, value: string | null | undefined) => {
        if (!value) return;
        const current = form.getValues(key);
        if (current === undefined || current === null || current === "") {
          form.setValue(key, value as never, { shouldDirty: false });
        }
      };
      fill("first_name", profile.first_name);
      fill("last_name", profile.last_name);
      fill("company_name", profile.company_name);
      fill("email", profile.email ?? user.email);
      fill("phone", profile.phone);
      fill("country", profile.country);
      fill("city", profile.city);
    };

    void resolve();

    let unsub: (() => void) | undefined;
    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void resolve();
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => { cancelled = true; unsub?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepFields: (keyof BuyerLeadInput)[][] = [
    ["vehicle_category", "vehicle_type"],
    ["min_year", "max_mileage", "ptac_kg", "payload_kg"],
    ["max_budget_ht"],
    ["first_name", "last_name", "email", "gdpr_consent"],
  ];

  const next = async () => {
    const ok = await form.trigger(stepFields[step] as (keyof BuyerLeadInput)[]);
    if (!ok) return;
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submitAuthenticated = useServerFn(submitBuyerLeadAuthenticated);

  const [submitting, setSubmitting] = useState(false);
  const onSubmit = form.handleSubmit(
    async (data) => {
      console.log('[dbg] submit valid', auth.status);
      if (submitting) return; // no double submit
      if (auth.status === "loading") {
        toast.error("Vérification de votre session en cours. Merci de patienter une seconde.");
        return;
      }
      if (auth.status === "authenticated" && auth.partnerKind !== "client") {
        toast.error(
          "Votre compte n'est pas un compte acheteur. Déconnectez-vous pour envoyer une demande, ou contactez Wilmet.",
        );
        return;
      }
      setSubmitting(true);
      const payload = {
        ...data,
        locale: i18n.language || "fr",
        referral_code: getStoredRef() ?? "",
      };
      try {
        // Authenticated buyers: ONE path only, no anonymous fallback ever.
        if (auth.status === "authenticated") {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: sess } = await supabase.auth.getSession();
          if (!sess.session?.access_token) {
            toast.error(
              "Votre session a expiré. Reconnectez-vous pour enregistrer cette demande dans votre espace.",
            );
            return;
          }
          try {
            const res = await submitAuthenticated({ data: payload });
            navigate({
              to: "/chercher-un-vehicule/merci",
              search: { ref: res.reference ?? "", tracked: 1 } as never,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            toast.error(
              readableError(
                msg,
                /unauthorized|401/i.test(msg)
                  ? "Votre session a expiré. Reconnectez-vous pour enregistrer cette demande dans votre espace."
                  : t("buyer.errors.submit"),
              ),
            );
          }
          return;
        }

        // Explicitly anonymous visitors.
        const r = await fetch("/api/public/buyer-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null;
          const fallback =
            r.status === 429
              ? "Trop de demandes. Merci de réessayer dans quelques minutes."
              : r.status >= 500
                ? t("buyer.errors.submit")
                : "Merci de vérifier les informations saisies.";
          toast.error(readableError(body?.error, fallback));
          return;
        }

        const body = (await r.json()) as { id: string; reference: string | null };
        navigate({
          to: "/chercher-un-vehicule/merci",
          search: { ref: body.reference ?? "", tracked: 0 } as never,
        });
      } catch (e) {
        console.error(e);
        toast.error(t("buyer.errors.submit"));
      } finally { setSubmitting(false); }
    },

    (errors) => {
      console.log('[dbg] submit invalid', Object.keys(errors));
      // Surface validation errors so the form never silently no-ops (F35).
      const firstBadStep = STEP_KEYS.findIndex((_, i) =>
        stepFields[i].some((f) => (errors as Record<string, unknown>)[f as string]),
      );
      if (firstBadStep >= 0 && firstBadStep !== step) setStep(firstBadStep);
      const fieldOrder = stepFields.flat();
      const firstField = fieldOrder.find((f) => (errors as Record<string, unknown>)[f as string])
        ?? (Object.keys(errors)[0] as keyof BuyerLeadInput | undefined);
      const label = firstField ? BUYER_FIELD_LABELS[firstField as string] ?? String(firstField) : "";
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
                    {refLoading && (
                      <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                        Chargement des référentiels…
                      </p>
                    )}
                    {refError && (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                        <span>Les listes de référence sont momentanément indisponibles.</span>
                        <button type="button" className="underline" onClick={() => void refRefetch()}>Réessayer</button>
                      </div>
                    )}
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
                            disabled={!category}
                            placeholder={category ? t("common.select") : t("buyer.fields.pickCategoryFirst", { defaultValue: "Sélectionnez d'abord une catégorie" })} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.modelOpt")}>
                        <Controller name="preferred_model" control={form.control} render={({ field }) => (
                          modelOptions.length > 0
                            ? <SearchableCombobox value={field.value || undefined} onChange={field.onChange} options={modelOptions} placeholder={t("common.select")} />
                            : <Input {...field} value={field.value ?? ""} disabled={!brandSlug} placeholder={brandSlug ? "Saisie libre" : "Sélectionnez d'abord une marque"} />
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
                      <Field label={t("buyer.fields.minYear")} error={form.formState.errors.min_year?.message}>
                        <Controller name="min_year" control={form.control} render={({ field }) => (
                          <YearPicker value={field.value ?? undefined} onChange={(v) => field.onChange(v ?? null)} />
                        )} />
                      </Field>
                      <Field label={t("buyer.fields.maxMileage")} hint="en km" error={form.formState.errors.max_mileage?.message}>
                        <Input inputMode="numeric" type="number" min={0} step={1000} {...form.register("max_mileage", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : v) })} />
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
                      <Field label={t("buyer.fields.ptac")} hint="Poids total autorisé en charge, en kg" error={form.formState.errors.ptac_kg?.message}>
                        <Input inputMode="numeric" type="number" min={0} {...form.register("ptac_kg", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : v) })} />
                      </Field>
                      <Field label={t("buyer.fields.payload")} hint="Charge utile en kg — laissez vide si sans importance" error={form.formState.errors.payload_kg?.message}>
                        <Input inputMode="numeric" type="number" min={0} {...form.register("payload_kg", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : v) })} />
                      </Field>
                    </div>
                    <Field label={t("buyer.fields.requiredEquipment")} hint="Sans ces équipements, le véhicule ne convient pas.">
                      <Controller name="required_equipment" control={form.control} render={({ field }) => (
                        <MultiSelectBadges value={field.value ?? []} onChange={field.onChange}
                          options={(ref?.equipment ?? []).map((e) => ({ value: e.slug, label: (i18n.language === "fr" ? e.label_fr : e.label_en) || e.label_fr }))} />
                      )} />
                    </Field>
                    <Field label={t("buyer.fields.wantedEquipment")} hint="Un plus appréciable, mais non bloquant.">
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
                        <Field label={t("buyer.fields.maxBudget")} hint="Budget maximum hors taxes (HT)" error={form.formState.errors.max_budget_ht?.message}>
                          <Input inputMode="decimal" type="number" min={0} step={100} {...form.register("max_budget_ht", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : v) })} />
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
                    {auth.status === "authenticated" && auth.partnerKind === "client" && (
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        Connecté en tant que <span className="font-medium text-foreground">{auth.email}</span> — cette demande sera enregistrée dans votre espace acheteur.
                      </p>
                    )}
                    {auth.status === "authenticated" && auth.partnerKind !== "client" && (
                      <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        Votre compte n'est pas un compte acheteur. Déconnectez-vous pour envoyer une demande, ou contactez Wilmet.
                      </p>
                    )}
                    <RequestRecap form={form} labels={{
                      category: categoryOptions.find((o) => o.value === form.watch("vehicle_category"))?.label,
                      type: (ref?.vehicleTypes ?? []).find((v) => v.slug === form.watch("vehicle_type"))?.label_fr,
                      body: bodyTypeOptions.find((o) => o.value === form.watch("body_type"))?.label,
                    }} />
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
                  submitting={submitting || auth.status === "loading"}
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

/** Never show a raw JSON/serialized error blob to the user. */
function readableError(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const text = raw.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return text;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj["error"] === "string") return obj["error"] as string;
      if (typeof obj["message"] === "string") return obj["message"] as string;
    }
  } catch { /* fall through */ }
  return fallback;
}

function RequestRecap({ form, labels }: {
  form: ReturnType<typeof useForm<BuyerLeadInput>>;
  labels: { category?: string; type?: string; body?: string };
}) {
  const v = form.watch();
  const num = (n: unknown, suffix: string) =>
    typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString("fr-FR")} ${suffix}` : null;
  const rows: [string, string | null][] = [
    ["Véhicule", [labels.category, labels.type, labels.body].filter(Boolean).join(" · ") || null],
    ["Marque / modèle", [v.preferred_brand, v.preferred_model].filter(Boolean).join(" ") || null],
    ["Critères", [
      v.min_year ? `à partir de ${v.min_year}` : null,
      num(v.max_mileage, "km max"),
      v.min_euro_norm || null,
      v.fuel_type || null,
      v.gearbox || null,
      num(v.ptac_kg, "kg PTAC"),
      num(v.payload_kg, "kg charge utile"),
    ].filter(Boolean).join(" · ") || null],
    ["Budget & délai", [
      num(v.max_budget_ht, `${v.currency ?? "EUR"} HT max`),
      v.buy_timeline || null,
      v.financing_needed ? `financement : ${v.financing_needed}` : null,
    ].filter(Boolean).join(" · ") || null],
  ];
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif de votre demande</p>
      <dl className="space-y-1">
        {rows.map(([k, val]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-36 shrink-0 text-muted-foreground">{k}</dt>
            <dd className="flex-1">{val ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Field({ label, children, required, error, hint }: { label: string; children: React.ReactNode; required?: boolean; error?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required
          ? <span className="text-destructive"> *</span>
          : <span className="ml-1 text-xs font-normal text-muted-foreground">(facultatif)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
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
