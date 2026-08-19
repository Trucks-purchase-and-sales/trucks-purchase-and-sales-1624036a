import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getPublicAssistantSettings } from "@/lib/app-settings.functions";

type Msg = { role: "user" | "assistant"; content: string };

function isWithinHours(cfg: { always_on: boolean; start_hour: number; end_hour: number }): boolean {
  if (cfg.always_on) return true;
  const h = new Date().getUTCHours();
  return cfg.start_hour <= cfg.end_hour
    ? h >= cfg.start_hour && h < cfg.end_hour
    : h >= cfg.start_hour || h < cfg.end_hour;
}

/** Public AI assistant that qualifies a buyer request outside office hours. */
export function AssistantWidget() {
  const fn = useServerFn(getPublicAssistantSettings);
  const { data: assistant } = useQuery({
    queryKey: ["public-assistant-settings"],
    queryFn: () => fn(),
  });

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, busy]);

  const active = !!assistant?.enabled && isWithinHours({
    always_on: assistant.always_on,
    start_hour: assistant.start_hour,
    end_hour: assistant.end_hour,
  });
  if (!mounted || !active) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !gdprConsent) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      // Keep the wire contract bounded even during long conversations. The
      // server independently validates the same 16-message / 2,000-char limits.
      const requestMessages = next.slice(-16).map((message) => ({
        ...message,
        content: message.content.slice(0, 2000),
      }));
      const r = await fetch("/api/public/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages, gdprConsent }),
      });
      const body = (await r.json()) as {
        reply?: string;
        reference?: string | null;
        error?: string;
        available?: boolean;
        consentRequired?: boolean;
      };
      if (body.consentRequired) {
        setGdprConsent(false);
        setMessages((m) => [...m, {
          role: "assistant",
          content: body.error ?? "Votre consentement est requis pour utiliser l'assistant.",
        }]);
      } else if (body.available === false) {
        setMessages((m) => [...m, { role: "assistant", content: "L'assistant n'est pas disponible pour le moment. Utilisez le formulaire « Chercher un véhicule » et nous vous répondons rapidement." }]);
      } else if (body.reply) {
        setMessages((m) => [...m, { role: "assistant", content: body.reply as string }]);
        if (body.reference) setReference(body.reference);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: body.error ?? "Une erreur est survenue, réessayez." }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: "assistant", content: "Connexion impossible. Réessayez dans un instant." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {open ? (
        <div className="flex h-[34rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-semibold">Assistant Wilmet</p>
              <p className="text-xs opacity-80">Décrivez votre besoin, nous rappelons</p>
            </div>
            <button type="button" aria-label="Fermer l'assistant" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.length === 0 && (
              <p className="rounded-lg bg-muted p-3 text-muted-foreground">
                Bonjour 👋 Quel type de véhicule industriel recherchez-vous ?
              </p>
            )}
            {messages.map((m, i) => (
              <p key={i} className={m.role === "user"
                ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                : "max-w-[90%] whitespace-pre-line rounded-lg bg-muted px-3 py-2"}>
                {m.content}
              </p>
            ))}
            {busy && <p className="text-xs text-muted-foreground">L'assistant rédige…</p>}
            {reference && (
              <p className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                Demande enregistrée — référence <strong>{reference}</strong>.
              </p>
            )}
          </div>

          <div className="border-t border-border px-3 pt-3">
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
              <Checkbox
                id="assistant-gdpr-consent"
                checked={gdprConsent}
                onCheckedChange={(checked) => setGdprConsent(checked === true)}
                disabled={busy}
                aria-describedby="assistant-gdpr-description"
              />
              <label
                id="assistant-gdpr-description"
                htmlFor="assistant-gdpr-consent"
                className="cursor-pointer text-[11px] leading-relaxed text-muted-foreground"
              >
                J’accepte que mes messages et coordonnées soient traités par Wilmet pour répondre à ma demande.{' '}
                <a
                  href="/confidentialite"
                  className="font-medium text-foreground underline underline-offset-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  Politique de confidentialité
                </a>
              </label>
            </div>
          </div>

          <form
            className="flex items-center gap-2 p-3"
            onSubmit={(e) => { e.preventDefault(); void send(); }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={gdprConsent ? "Votre message…" : "Acceptez d’abord la confidentialité"}
              aria-label="Votre message"
              maxLength={2000}
              disabled={busy || !gdprConsent}
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !gdprConsent || !input.trim()}
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : (
        <Button onClick={() => setOpen(true)} size="lg" className="gap-2 rounded-full shadow-lg">
          <MessageCircle className="h-5 w-5" /> Assistant
        </Button>
      )}
    </div>
  );
}
