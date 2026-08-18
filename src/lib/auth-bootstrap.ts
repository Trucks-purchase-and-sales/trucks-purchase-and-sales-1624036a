export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | string;

type AuthSubscription = {
  unsubscribe: () => void;
};

type AuthClientLike = {
  auth: {
    onAuthStateChange: (
      callback: (event: AuthEvent, session?: unknown) => void,
    ) => { data: { subscription: AuthSubscription } };
  };
};

type AuthBootstrapOptions = {
  client: AuthClientLike;
  onRelevantEvent: (event: AuthEvent) => void;
  onError: (error: unknown) => void;
};

const RELEVANT_AUTH_EVENTS = new Set<AuthEvent>([
  "SIGNED_IN",
  "SIGNED_OUT",
  "USER_UPDATED",
]);

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
