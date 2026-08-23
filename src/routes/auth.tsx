import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18nInit } from "@/i18n/useI18nInit";
import { resolveRoleHome } from "@/hooks/useRoleHome";
import { supabase } from "@/integrations/supabase/client";
import { NEW_PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/password-policy";
import { getStoredRef } from "@/lib/referral";
import { PROVIDER_TYPE_OPTIONS } from "@/lib/wilmet-constants";

type Search = { mode?: "login" | "signup"; kind?: "client" | "seller" };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" ? "signup" : "login",
    // The account type comes from the link the visitor clicked: seller (proposer un
    // véhicule) or client (chercher un véhicule). Never silently default to client.
    kind: s.kind === "seller" ? "seller" : s.kind === "client" ? "client" : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const home = await resolveRoleHome(data.session.user.id);
      throw redirect({ to: home });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  useI18nInit();
  const { t } = useTranslation();
  const { mode, kind } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup" | "forgot">(
    mode === "signup" ? "signup" : "login",
  );

  useEffect(() => {
    setTab((current) => (current === "forgot" ? current : mode === "signup" ? "signup" : "login"));
  }, [mode]);

  function selectAuthTab(next: "login" | "signup") {
    setTab(next);
    navigate({
      to: "/auth",
      search: next === "signup" ? { mode: "signup", kind } : { mode: "login" },
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="container-page flex min-h-screen items-center justify-center py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 flex items-center justify-center">
            <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-14 w-auto" />
          </Link>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">
                {tab === "signup"
                  ? t("auth.title.signup")
                  : tab === "forgot"
                    ? t("auth.title.forgot")
                    : t("auth.title.login")}
              </CardTitle>
              <CardDescription>
                {tab === "signup"
                  ? t("auth.subtitle.signup")
                  : tab === "forgot"
                    ? t("auth.subtitle.forgot")
                    : t("auth.subtitle.login")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tab !== "forgot" && (
                <Tabs
                  value={tab}
                  onValueChange={(value) => selectAuthTab(value as "login" | "signup")}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">{t("auth.tabs.login")}</TabsTrigger>
                    <TabsTrigger value="signup">{t("auth.tabs.signup")}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login" className="mt-6">
                    <LoginForm
                      onForgot={() => setTab("forgot")}
                      onSuccess={async (uid) => {
                        const home = await resolveRoleHome(uid);
                        navigate({ to: home });
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="signup" className="mt-6">
                    <SignupForm
                      initialKind={kind}
                      onShowLogin={() => selectAuthTab("login")}
                      onAuthenticated={async (uid) => {
                        const home = await resolveRoleHome(uid);
                        navigate({ to: home, replace: true });
                      }}
                    />
                  </TabsContent>
                </Tabs>
              )}
              {tab === "forgot" && <ForgotForm onBack={() => selectAuthTab("login")} />}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">{t("auth.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  onForgot,
  onSuccess,
}: {
  onForgot: () => void;
  onSuccess: (userId: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error || !data.user) {
      toast.error(t("auth.login.errorTitle"), {
        description: error?.message ?? t("auth.login.errorFallback"),
      });
      return;
    }
    toast.success(t("auth.login.successTitle"));
    await onSuccess(data.user.id);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("buyer.fields.email")}>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label={t("auth.fields.password")}>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onForgot}
          className="text-xs font-medium text-accent hover:underline"
        >
          {t("auth.login.forgotLink")}
        </button>
      </div>
      <Button
        disabled={loading}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        size="lg"
      >
        {loading ? t("auth.login.submitLoading") : t("auth.login.submit")}
      </Button>
    </form>
  );
}

/** message stays as-is when it doesn't match a known Auth failure signature. */
function readableSignupError(message: string, fallback: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("database error saving new user") ||
    normalized.includes("error occurred")
  ) {
    return fallback;
  }
  return message;
}

function SignupForm({
  onShowLogin,
  onAuthenticated,
  initialKind,
}: {
  onShowLogin: () => void;
  onAuthenticated: (userId: string) => void | Promise<void>;
  initialKind?: "client" | "seller";
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    email: "",
    phone: "",
    provider_type: "",
    city: "",
    country: "France",
    password: "",
  });
  // The type is fixed at creation and cannot be changed afterwards, so it must be
  // explicit here rather than inherited from a default.
  const [kind, setKind] = useState<"client" | "seller" | "">(initialKind ?? "");
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const set = <K extends keyof typeof form>(k: K, value: string) =>
    setForm((current) => ({ ...current, [k]: value }));

  useEffect(() => {
    if (initialKind) setKind(initialKind);
  }, [initialKind]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind !== "client" && kind !== "seller") {
      toast.error(t("auth.signup.kindRequiredTitle"), {
        description: t("auth.signup.kindRequiredDescription"),
      });
      return;
    }

    const passwordValidation = validateNewPassword(form.password);
    if (!passwordValidation.valid) {
      toast.error(t("auth.password.tooShortTitle"), { description: passwordValidation.message });
      return;
    }

    setLoading(true);
    try {
      const check = await fetch("/api/public/signup-check", { method: "POST" });
      if (check.status === 429) {
        const body = await check.json().catch(() => ({}));
        toast.error(t("auth.signup.rateLimitedTitle"), {
          description: body?.error ?? t("auth.signup.rateLimitedFallback"),
        });
        setLoading(false);
        return;
      }
    } catch {
      // Network hiccup on the advisory check — proceed with Auth itself.
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // Returning through /auth lets its session guard resolve the canonical
        // role home (seller, buyer, staff) instead of hard-coding /dashboard.
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          partner_kind: kind,
          // Lifetime attribution: whoever shared the link that brought this account.
          referral_code: getStoredRef() ?? "",
          first_name: form.first_name,
          last_name: form.last_name,
          company_name: form.company_name,
          phone: form.phone,
          provider_type: form.provider_type,
          city: form.city,
          country: form.country,
        },
      },
    });
    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        setPendingEmail(form.email);
        return;
      }
      toast.error(t("auth.signup.errorTitle"), {
        description: readableSignupError(error.message, t("auth.signup.errorFallback")),
      });
      return;
    }

    if (data.session) {
      toast.success(t("auth.signup.successTitle"), {
        description: t("auth.signup.successDescription"),
      });
      await onAuthenticated(data.session.user.id);
      return;
    }

    // Supabase returns a user with empty identities[] when the email is already
    // registered but unconfirmed.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setPendingEmail(form.email);
      return;
    }

    setSubmittedEmail(form.email);
  }

  async function resendConfirmation(email: string) {
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setResending(false);

    if (error) {
      toast.error(t("auth.resend.errorTitle"), { description: error.message });
      return;
    }

    toast.success(t("auth.resend.successTitle"), {
      description: t("auth.resend.successDescription", { email }),
    });
    setSubmittedEmail(email);
    setPendingEmail(null);
  }

  if (pendingEmail) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-status-pending/40 bg-status-pending/10 p-5 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-status-pending">
            <svg
              className="h-6 w-6 text-status-pending-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <h3 className="text-base font-bold">{t("auth.pending.title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.pending.textBefore")}{" "}
            <span className="break-all font-medium text-foreground">{pendingEmail}</span>{" "}
            {t("auth.pending.textAfter")}
          </p>
        </div>
        <Button
          onClick={() => resendConfirmation(pendingEmail)}
          disabled={resending}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
        >
          {resending ? t("auth.common.sendingLoading") : t("auth.pending.resendButton")}
        </Button>
        <button
          type="button"
          onClick={() => setPendingEmail(null)}
          className="mx-auto block text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("auth.pending.useAnotherEmail")}
        </button>
      </div>
    );
  }

  if (submittedEmail) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-status-accepted/40 bg-status-accepted/10 p-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-status-accepted">
            <svg
              className="h-7 w-7 text-status-accepted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-xl font-bold">{t("auth.submitted.title")}</h3>
          <p className="mt-3 text-sm text-muted-foreground">{t("auth.submitted.textBefore")}</p>
          <p className="mt-1 break-all text-base font-semibold text-foreground">{submittedEmail}</p>
          <p className="mt-3 text-sm text-muted-foreground">{t("auth.submitted.textAfter")}</p>
        </div>
        <Button
          onClick={onShowLogin}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
        >
          {t("auth.submitted.goToLogin")}
        </Button>
        <div className="text-center">
          <button
            type="button"
            onClick={() => resendConfirmation(submittedEmail)}
            disabled={resending}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
          >
            {resending ? t("auth.common.sendingLoading") : t("auth.submitted.resendPrompt")}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">{t("auth.submitted.spamNote")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/40 p-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("auth.signup.accountSectionLabel")}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                value: "seller",
                title: t("auth.signup.kindSellerTitle"),
                hint: t("auth.signup.kindSellerHint"),
              },
              {
                value: "client",
                title: t("auth.signup.kindClientTitle"),
                hint: t("auth.signup.kindClientHint"),
              },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              aria-pressed={kind === option.value}
              className={`rounded-md border p-3 text-left transition-colors ${
                kind === option.value
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-background hover:border-accent/50"
              }`}
            >
              <span className="block text-sm font-semibold">{option.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("auth.signup.kindNote")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("buyer.fields.firstName")}>
          <Input
            required
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </Field>
        <Field label={t("buyer.fields.lastName")}>
          <Input
            required
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("buyer.fields.company")}>
        <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
      </Field>

      <Field label={t("auth.fields.providerType")}>
        <Select value={form.provider_type} onValueChange={(value) => set("provider_type", value)}>
          <SelectTrigger>
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("buyer.fields.email")}>
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label={t("buyer.fields.phone")}>
          <Input
            type="tel"
            required
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("buyer.fields.city")}>
          <Input required value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label={t("buyer.fields.country")}>
          <Input required value={form.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
      </div>

      <Field label={t("auth.fields.password")}>
        <Input
          type="password"
          required
          minLength={NEW_PASSWORD_MIN_LENGTH}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">
          {t("auth.passwordHelp", { min: NEW_PASSWORD_MIN_LENGTH })}
        </p>
      </Field>

      <Button
        disabled={loading}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        size="lg"
      >
        {loading ? t("auth.signup.submitLoading") : t("auth.signup.submit")}
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast.error(t("auth.forgot.errorTitle"), { description: error.message });
      return;
    }

    toast.success(t("auth.forgot.successTitle"), {
      description: t("auth.forgot.successDescription"),
    });
    onBack();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("buyer.fields.email")}>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button
        disabled={loading}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        size="lg"
      >
        {loading ? t("auth.common.sendingLoading") : t("auth.forgot.submit")}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto block text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {t("auth.forgot.back")}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
