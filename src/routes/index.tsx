import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Truck, Camera, Send, Clock, ShieldCheck, CheckCircle2, Route as RouteIcon,
  Wrench, Package, Snowflake, ArrowRight, MapPin, PhoneCall, Search, Handshake,
  Layers, Globe2,
} from "lucide-react";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18nInit } from "@/i18n/useI18nInit";
import { AssistantWidget } from "@/components/public/AssistantWidget";
import { PublicAccountActions } from "@/components/public/PublicAccountActions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wilmet Trucks — Négoce européen de poids lourds et utilitaires" },
      { name: "description", content: "Wilmet achète, revend et source des véhicules professionnels en Europe. Proposez votre véhicule ou trouvez celui dont vous avez besoin." },
      { property: "og:title", content: "Wilmet Trucks — Négoce européen de poids lourds et utilitaires" },
      { property: "og:description", content: "Wilmet achète, revend et source des véhicules professionnels en Europe. Proposez votre véhicule ou trouvez celui dont vous avez besoin." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  useI18nInit();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <TwoCards />
      <HowItWorks />
      <VehicleTypes />
      <WhyWilmet />
      <ContactBlock />
      <Footer />
      <AssistantWidget />
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center shrink-0">
          <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/vehicules" className="font-medium text-foreground hover:text-accent">Véhicules à vendre</Link>
          <a href="#how" className="hover:text-foreground">{t("nav.how")}</a>
          <a href="#types" className="hover:text-foreground">{t("nav.types")}</a>
          <a href="#contact" className="hover:text-foreground">{t("nav.contact")}</a>
        </nav>

        <PublicAccountActions />
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-primary"
        style={{
          backgroundImage:
            "radial-gradient(1400px 600px at 15% -10%, oklch(0.32 0.06 260) 0%, transparent 60%), radial-gradient(900px 500px at 95% 10%, oklch(0.55 0.18 27 / 0.35) 0%, transparent 60%)",
        }}
      />
      <div className="container-page relative pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground/90 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("hero.eyebrow")}
          </span>
          <h1 className="mt-5 text-2xl font-extrabold leading-[1.15] tracking-tight text-primary-foreground sm:text-4xl lg:text-5xl">
            {t("hero.headline")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
            {t("hero.subtitle")}
          </p>
        </div>
      </div>
    </section>
  );
}

function TwoCards() {
  const { t } = useTranslation();
  const cards = [
    {
      title: t("cta.propose.title"),
      text: t("cta.propose.text"),
      button: t("cta.propose.button"),
      to: "/auth",
      search: { mode: "signup", kind: "seller" } as const,
      icon: Truck,
      tone: "bg-primary text-primary-foreground",
      buttonClass: "bg-accent text-accent-foreground hover:bg-accent/90",
      badge: "Vendeur",
    },
    {
      title: t("cta.search.title"),
      text: t("cta.search.text"),
      button: t("cta.search.button"),
      to: "/chercher-un-vehicule",
      icon: Search,
      tone: "bg-card border border-border",
      buttonClass: "bg-primary text-primary-foreground hover:bg-primary/90",
      badge: "Acheteur",
    },
  ] as const;

  return (
    <section className="container-page -mt-8 pb-14 sm:-mt-16 sm:pb-20">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        {cards.map((c) => (
          <article key={c.title} className={`group relative overflow-hidden rounded-3xl p-6 shadow-xl transition-shadow hover:shadow-2xl sm:p-10 ${c.tone}`}>
            <span className="absolute right-5 top-5 rounded-full bg-black/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest opacity-70">
              {c.badge}
            </span>
            <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-black/10 backdrop-blur sm:h-14 sm:w-14">
              <c.icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed opacity-85 sm:text-base">{c.text}</p>
            <div className="mt-8">
              <Button asChild size="lg" className={c.buttonClass}>
                {"search" in c ? (
                  <Link to={c.to} search={c.search as never}>{c.button}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                ) : (
                  <Link to={c.to}>{c.button}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                )}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useTranslation();
  const sellers = [
    { icon: Truck, k: "s1" },
    { icon: Camera, k: "s2" },
    { icon: Send, k: "s3" },
    { icon: Handshake, k: "s4" },
  ] as const;
  const buyers = [
    { icon: Search, k: "s1" },
    { icon: Layers, k: "s2" },
    { icon: Handshake, k: "s3" },
    { icon: CheckCircle2, k: "s4" },
  ] as const;
  return (
    <section id="how" className="bg-secondary/50 py-14 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t("how.title")}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Un parcours simple pour vendeurs et acheteurs.</h2>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Column title={t("how.sellers.title")} items={sellers.map((s, i) => ({ icon: s.icon, title: t(`how.sellers.${s.k}`), text: t(`how.sellers.${s.k}d`), n: i + 1 }))} />
          <Column title={t("how.buyers.title")} items={buyers.map((s, i) => ({ icon: s.icon, title: t(`how.buyers.${s.k}`), text: t(`how.buyers.${s.k}d`), n: i + 1 }))} />
        </div>
      </div>
    </section>
  );
}

function Column({ title, items }: { title: string; items: { icon: any; title: string; text: string; n: number }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h3 className="text-xl font-semibold">{title}</h3>
      <ol className="mt-6 space-y-4">
        {items.map((s) => (
          <li key={s.title} className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Étape {s.n}
              </div>
              <div className="mt-0.5 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VehicleTypes() {
  const { t } = useTranslation();
  const items = [
    { icon: Truck, k: "utilitaire_leger" },
    { icon: Truck, k: "camion_porteur" },
    { icon: Truck, k: "tracteur_routier" },
    { icon: Package, k: "semi_remorque" },
    { icon: Package, k: "remorque" },
    { icon: Wrench, k: "benne" },
    { icon: Snowflake, k: "frigorifique" },
    { icon: Package, k: "plateau" },
    { icon: Truck, k: "fourgon" },
    { icon: Wrench, k: "nacelle" },
    { icon: Wrench, k: "specialise" },
  ] as const;
  return (
    <section id="types" className="container-page py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t("types.title")}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Catégories traitées par Wilmet.</h2>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((i) => (
          <div key={i.k} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/5 text-primary">
              <i.icon className="h-5 w-5" />
            </div>
            <div className="mt-3 text-sm font-semibold">{t(`types.${i.k}`)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyWilmet() {
  const { t } = useTranslation();
  const items = [
    { icon: Clock, k: 1 },
    { icon: ShieldCheck, k: 2 },
    { icon: Globe2, k: 3 },
  ] as const;
  return (
    <section className="bg-primary py-14 text-primary-foreground sm:py-20">
      <div className="container-page">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t("why.title")}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Un partenaire européen de confiance.</h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/80 sm:text-lg">{t("why.intro")}</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.k} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 backdrop-blur">
              <i.icon className="h-6 w-6 text-accent" />
              <div className="mt-4 text-base font-semibold">{t(`why.${i.k}t`)}</div>
              <p className="mt-1 text-sm text-primary-foreground/70">{t(`why.${i.k}d`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactBlock() {
  const { t } = useTranslation();
  return (
    <section id="contact" className="container-page py-14 sm:py-20">
      <div className="grid gap-8 rounded-3xl border border-border bg-card p-8 sm:p-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t("contact.title")}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Une question ? Un besoin spécifique ?</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("contact.text")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/auth" search={{ mode: "signup", kind: "seller" } as never}>{t("cta.propose.button")}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/chercher-un-vehicule">{t("cta.search.button")}</Link>
            </Button>
          </div>
        </div>
        <ul className="space-y-4 text-sm">
          <li className="flex items-start gap-3"><PhoneCall className="mt-0.5 h-5 w-5 text-accent" /><div><div className="font-semibold">{t("contact.phone")}</div><div className="text-muted-foreground">Sur demande via le formulaire</div></div></li>
          <li className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" /><div><div className="font-semibold">{t("contact.email")}</div><div className="text-muted-foreground">contact@wilmet.eu</div></div></li>
          <li className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-accent" /><div><div className="font-semibold">{t("contact.address")}</div><div className="text-muted-foreground">Wilmet Trucks — Belgique</div></div></li>
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container-page flex flex-col gap-6 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-7 w-auto" />
            <span>· {t("footer.tagline")}</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher compact />
            <span>© {new Date().getFullYear()} Wilmet. {t("footer.rights")}</span>
          </div>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-border/40 pt-4 text-xs">
          <Link to="/mentions-legales" className="hover:text-foreground">Mentions légales</Link>
          <Link to="/cgu" className="hover:text-foreground">CGU</Link>
          <Link to="/cgv" className="hover:text-foreground">CGV</Link>
          <Link to="/confidentialite" className="hover:text-foreground">Confidentialité</Link>
          <Link to="/cookies" className="hover:text-foreground">Cookies</Link>
        </nav>
      </div>
    </footer>
  );
}
