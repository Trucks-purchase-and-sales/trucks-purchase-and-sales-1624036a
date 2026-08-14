import { createFileRoute, Link, useNavigate, useSearch, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROVIDER_TYPE_OPTIONS } from "@/lib/wilmet-constants";
import { resolveRoleHome } from "@/hooks/useRoleHome";
import { getStoredRef } from "@/lib/referral";

import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";

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
  const { mode, kind } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup" | "forgot">(mode === "signup" ? "signup" : "login");
  useEffect(() => { setTab(mode === "signup" ? "signup" : "login"); }, [mode]);

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
                {tab === "signup" ? "Créer un compte partenaire" : tab === "forgot" ? "Mot de passe oublié" : "Connexion partenaire"}
              </CardTitle>
              <CardDescription>
                {tab === "signup"
                  ? "Rejoignez le portail partenaires Wilmet en quelques secondes."
                  : tab === "forgot"
                  ? "Nous vous enverrons un e-mail pour réinitialiser votre mot de passe."
                  : "Accédez à votre espace pour suivre vos opportunités."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tab !== "forgot" && (
                <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Connexion</TabsTrigger>
                    <TabsTrigger value="signup">Inscription</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login" className="mt-6">
                    <LoginForm onForgot={() => setTab("forgot")} onSuccess={async (uid) => {
                      const home = await resolveRoleHome(uid);
                      navigate({ to: home });
                    }} />
                  </TabsContent>
                  <TabsContent value="signup" className="mt-6">
                    <SignupForm initialKind={kind} onSuccess={() => setTab("login")} />
                  </TabsContent>
                </Tabs>
              )}
              {tab === "forgot" && <ForgotForm onBack={() => setTab("login")} />}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            En continuant, vous acceptez d'être contacté(e) par Wilmet au sujet de vos opportunités.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onForgot, onSuccess }: { onForgot: () => void; onSuccess: (userId: string) => void | Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error || !data.user) { toast.error("Connexion impossible", { description: error?.message ?? "Erreur inconnue" }); return; }
    toast.success("Bienvenue");
    onSuccess(data.user.id);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <Field label="Mot de passe">
        <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </Field>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onForgot} className="text-xs font-medium text-accent hover:underline">Mot de passe oublié ?</button>
      </div>
      <Button disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
        {loading ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

function SignupForm({ onSuccess, initialKind }: { onSuccess: () => void; initialKind?: "client" | "seller" }) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", company_name: "", email: "", phone: "",
    provider_type: "", city: "", country: "France", password: "",
  });
  // The type is fixed at creation and cannot be changed afterwards, so it must be
  // explicit here rather than inherited from a default.
  const [kind, setKind] = useState<"client" | "seller" | "">(initialKind ?? "");
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind !== "client" && kind !== "seller") {
      toast.error("Type de compte requis", { description: "Indiquez si vous souhaitez vendre ou acheter un véhicule." });
      return;
    }
    setLoading(true);
    try {
      const check = await fetch("/api/public/signup-check", { method: "POST" });
      if (check.status === 429) {
        const body = await check.json().catch(() => ({}));
        toast.error("Trop de tentatives", { description: body?.error ?? "Merci de réessayer plus tard." });
        setLoading(false);
        return;
      }
    } catch {
      // network hiccup on advisory check — proceed
    }
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
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
      toast.error("Inscription impossible", { description: error.message });
      return;
    }
    if (data.session) {
      toast.success("Compte créé", { description: "Bienvenue sur Wilmet Opportunités." });
      onSuccess();
      return;
    }
    // Supabase returns a user with empty identities[] when the email is already registered but unconfirmed
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
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setResending(false);
    if (error) { toast.error("Envoi impossible", { description: error.message }); return; }
    toast.success("E-mail renvoyé", { description: `Un nouveau lien a été envoyé à ${email}.` });
    setSubmittedEmail(email);
    setPendingEmail(null);
  }

  if (pendingEmail) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-status-pending/40 bg-status-pending/10 p-5 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-status-pending">
            <svg className="h-6 w-6 text-status-pending-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          </div>
          <h3 className="text-base font-bold">Un compte existe déjà</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            L'adresse <span className="font-medium text-foreground break-all">{pendingEmail}</span> a déjà été utilisée pour créer un compte, mais celui-ci n'a pas encore été confirmé par e-mail.
          </p>
        </div>
        <Button onClick={() => resendConfirmation(pendingEmail)} disabled={resending} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
          {resending ? "Envoi…" : "Renvoyer l'e-mail de confirmation"}
        </Button>
        <button type="button" onClick={() => setPendingEmail(null)} className="mx-auto block text-xs font-medium text-muted-foreground hover:text-foreground">
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  if (submittedEmail) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-status-accepted/40 bg-status-accepted/10 p-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-status-accepted">
            <svg className="h-7 w-7 text-status-accepted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h3 className="text-xl font-bold">Vérifiez votre boîte e-mail</h3>
          <p className="mt-3 text-sm text-muted-foreground">Nous venons d'envoyer un lien de confirmation à</p>
          <p className="mt-1 text-base font-semibold text-foreground break-all">{submittedEmail}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Cliquez sur le lien reçu pour activer votre compte, puis revenez ici pour vous connecter.
          </p>
        </div>
        <Button onClick={onSuccess} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
          Aller à la connexion
        </Button>
        <div className="text-center">
          <button type="button" onClick={() => resendConfirmation(submittedEmail)} disabled={resending} className="text-xs font-medium text-accent hover:underline disabled:opacity-50">
            {resending ? "Envoi…" : "Vous n'avez rien reçu ? Renvoyer l'e-mail"}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Pensez à vérifier vos spams si l'e-mail n'arrive pas.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/40 p-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Votre compte
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "seller", title: "Je vends", hint: "Je propose des véhicules" },
            { value: "client", title: "J'achète", hint: "Je cherche des véhicules" },
          ] as const).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setKind(o.value)}
              aria-pressed={kind === o.value}
              className={`rounded-md border p-3 text-left transition-colors ${
                kind === o.value
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-background hover:border-accent/50"
              }`}
            >
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Ce choix est définitif : un compte est soit vendeur, soit acheteur.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom"><Input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
        <Field label="Nom"><Input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
      </div>
      <Field label="Société"><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
      <Field label="Type de partenaire">
        <Select value={form.provider_type} onValueChange={(v) => set("provider_type", v)}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
          <SelectContent>
            {PROVIDER_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
        <Field label="Téléphone"><Input type="tel" required value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ville"><Input required value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Pays"><Input required value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
      </div>
      <Field label="Mot de passe"><Input type="password" required minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" /></Field>
      <Button disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
        {loading ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error("Échec de l'envoi", { description: error.message }); return; }
    toast.success("E-mail envoyé", { description: "Consultez votre boîte de réception." });
    onBack();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Button disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
        {loading ? "Envoi…" : "Envoyer le lien"}
      </Button>
      <button type="button" onClick={onBack} className="mx-auto block text-xs font-medium text-muted-foreground hover:text-foreground">
        Retour à la connexion
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
