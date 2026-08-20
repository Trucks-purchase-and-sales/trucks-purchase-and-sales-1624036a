export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | string;

type AuthSubscription = {
  unsubscribe: () => void;
};

type AuthClientLike = {
  auth: {
    onAuthStateChange: (callback: (event: AuthEvent, session?: unknown) => void) => {
      data: { subscription: AuthSubscription };
    };
  };
};

type AuthBootstrapOptions = {
  client: AuthClientLike;
  onRelevantEvent: (event: AuthEvent) => void;
  onError: (error: unknown) => void;
};

type SessionLike = { user: { id: string } } | null;

type SessionAwareAuthClientLike = {
  auth: {
    getSession: () => Promise<{ data: { session: SessionLike } }>;
    onAuthStateChange: (callback: (event: AuthEvent, session: SessionLike) => void) => {
      data: { subscription: AuthSubscription };
    };
  };
};

type PublicSessionBootstrapOptions = {
  client: SessionAwareAuthClientLike;
  onSession: (userId?: string) => void;
  onError: (error: unknown) => void;
};

const RELEVANT_AUTH_EVENTS = new Set<AuthEvent>(["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"]);

/**
 * Subscribe the application shell to auth changes without making public-page
 * availability depend on auth-client initialization.
 *
 * A missing/malformed browser Supabase configuration can throw synchronously
 * while the lazy client resolves `client.auth`. That is an operational error,
 * but it must not black-screen the anonymous Wilmet storefront.
 *
 * This helper does not grant access or invent a session. On bootstrap failure
 * it simply leaves the shell unauthenticated and reports the error to the
 * caller. Protected routes remain responsible for enforcing authentication.
 */
export function startAuthBootstrap({
  client,
  onRelevantEvent,
  onError,
}: AuthBootstrapOptions): () => void {
  try {
    const { data } = client.auth.onAuthStateChange((event) => {
      if (!RELEVANT_AUTH_EVENTS.has(event)) return;
      onRelevantEvent(event);
    });

    return () => {
      try {
        data.subscription.unsubscribe();
      } catch (error) {
        onError(error);
      }
    };
  } catch (error) {
    onError(error);
    return () => undefined;
  }
}

/**
 * Resolve the current browser session and keep it synchronized for public UI.
 *
 * Public chrome must remain usable when the lazy Supabase client cannot
 * initialize (for example, a preview missing browser runtime variables) or
 * when the initial session lookup rejects. In those cases we deliberately
 * fall back to anonymous public controls. This does not weaken protected-route
 * authorization; it only prevents optional session-aware chrome from taking
 * down the public application shell.
 */
export function startPublicSessionBootstrap({
  client,
  onSession,
  onError,
}: PublicSessionBootstrapOptions): () => void {
  let active = true;

  try {
    const auth = client.auth;
    const { data } = auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      onSession(session?.user.id);
    });

    void auth
      .getSession()
      .then(({ data: sessionData }) => {
        if (!active) return;
        onSession(sessionData.session?.user.id);
      })
      .catch((error) => {
        if (!active) return;
        onError(error);
        onSession(undefined);
      });

    return () => {
      active = false;
      try {
        data.subscription.unsubscribe();
      } catch (error) {
        onError(error);
      }
    };
  } catch (error) {
    onError(error);
    onSession(undefined);
    return () => undefined;
  }
}
