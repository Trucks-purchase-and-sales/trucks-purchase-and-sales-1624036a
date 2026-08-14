// Browser-side referral capture. A visitor arriving with ?ref=CODE gets the
// code stored for 90 days so any later form submission or signup stays credited
// to the person who shared the link.

const STORAGE_KEY = "wilmet_ref";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

type Stored = { code: string; at: number };

export function normalizeRefCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase().slice(0, 40);
  return /^[A-Z0-9-]{3,40}$/.test(code) ? code : null;
}

export function getStoredRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.code || Date.now() - parsed.at > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return normalizeRefCode(parsed.code);
  } catch {
    return null;
  }
}

function storeRef(code: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, at: Date.now() } satisfies Stored));
  } catch {
    /* private browsing — attribution simply won't persist */
  }
}

/**
 * Reads ?ref= from the current URL, persists it and records the click.
 * Safe to call on every navigation: a click is only recorded when the code
 * is present in the URL.
 */
export function captureRefFromUrl(): void {
  if (typeof window === "undefined") return;
  const code = normalizeRefCode(new URLSearchParams(window.location.search).get("ref"));
  if (!code) return;
  const previous = getStoredRef();
  storeRef(code);
  if (previous === code) return; // don't double count reloads of the same link
  void fetch("/api/public/affiliate-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      path: window.location.pathname,
      referer: document.referrer || null,
      locale: document.documentElement.lang || null,
    }),
  }).catch(() => undefined);
}

/** Full shareable link for a code, e.g. https://site/?ref=CODE */
export function buildAffiliateUrl(origin: string, code: string, path = "/"): string {
  const url = new URL(path, origin);
  url.searchParams.set("ref", code);
  return url.toString();
}
