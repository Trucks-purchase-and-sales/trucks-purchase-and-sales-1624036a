import { describe, expect, test } from "bun:test";
import { startAuthBootstrap, startPublicSessionBootstrap } from "./auth-bootstrap";

describe("startAuthBootstrap", () => {
  test("does not propagate a synchronous auth-client bootstrap failure", () => {
    const errors: unknown[] = [];
    const configError = new Error("Missing browser Supabase configuration");
    const client = Object.defineProperty({}, "auth", {
      get() {
        throw configError;
      },
    });

    expect(() => {
      const cleanup = startAuthBootstrap({
        client: client as never,
        onRelevantEvent: () => undefined,
        onError: (error) => errors.push(error),
      });
      cleanup();
    }).not.toThrow();

    expect(errors).toEqual([configError]);
  });

  test("forwards only shell-relevant auth events", () => {
    const events: string[] = [];
    let callback: ((event: string) => void) | undefined;

    const client = {
      auth: {
        onAuthStateChange: (cb: (event: string) => void) => {
          callback = cb;
          return { data: { subscription: { unsubscribe: () => undefined } } };
        },
      },
    };

    startAuthBootstrap({
      client,
      onRelevantEvent: (event) => events.push(event),
      onError: () => undefined,
    });

    callback?.("TOKEN_REFRESHED");
    callback?.("SIGNED_IN");
    callback?.("USER_UPDATED");
    callback?.("SIGNED_OUT");

    expect(events).toEqual(["SIGNED_IN", "USER_UPDATED", "SIGNED_OUT"]);
  });

  test("returns a cleanup that unsubscribes", () => {
    let unsubscribed = false;
    const client = {
      auth: {
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: () => {
                unsubscribed = true;
              },
            },
          },
        }),
      },
    };

    const cleanup = startAuthBootstrap({
      client,
      onRelevantEvent: () => undefined,
      onError: () => undefined,
    });
    cleanup();

    expect(unsubscribed).toBe(true);
  });

  test("reports cleanup failures without throwing", () => {
    const cleanupError = new Error("unsubscribe failed");
    const errors: unknown[] = [];
    const client = {
      auth: {
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: () => {
                throw cleanupError;
              },
            },
          },
        }),
      },
    };

    const cleanup = startAuthBootstrap({
      client,
      onRelevantEvent: () => undefined,
      onError: (error) => errors.push(error),
    });

    expect(cleanup).not.toThrow();
    expect(errors).toEqual([cleanupError]);
  });
});

describe("startPublicSessionBootstrap", () => {
  test("falls back to anonymous when the auth getter throws synchronously", () => {
    const errors: unknown[] = [];
    const sessions: Array<string | undefined> = [];
    const configError = new Error("Missing browser Supabase configuration");
    const client = Object.defineProperty({}, "auth", {
      get() {
        throw configError;
      },
    });

    expect(() => {
      const cleanup = startPublicSessionBootstrap({
        client: client as never,
        onSession: (userId) => sessions.push(userId),
        onError: (error) => errors.push(error),
      });
      cleanup();
    }).not.toThrow();

    expect(errors).toEqual([configError]);
    expect(sessions).toEqual([undefined]);
  });

  test("falls back to anonymous when the initial session lookup rejects", async () => {
    const errors: unknown[] = [];
    const sessions: Array<string | undefined> = [];
    const sessionError = new Error("session lookup failed");
    const client = {
      auth: {
        getSession: async () => {
          throw sessionError;
        },
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => undefined } },
        }),
      },
    };

    const cleanup = startPublicSessionBootstrap({
      client,
      onSession: (userId) => sessions.push(userId),
      onError: (error) => errors.push(error),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(errors).toEqual([sessionError]);
    expect(sessions).toEqual([undefined]);
    cleanup();
  });

  test("reports the current session and later auth-state changes", async () => {
    const sessions: Array<string | undefined> = [];
    let callback: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "seller-a" } } },
        }),
        onAuthStateChange: (
          cb: (event: string, session: { user: { id: string } } | null) => void,
        ) => {
          callback = cb;
          return { data: { subscription: { unsubscribe: () => undefined } } };
        },
      },
    };

    const cleanup = startPublicSessionBootstrap({
      client,
      onSession: (userId) => sessions.push(userId),
      onError: () => undefined,
    });

    await Promise.resolve();
    callback?.("SIGNED_OUT", null);

    expect(sessions).toEqual(["seller-a", undefined]);
    cleanup();
  });
});
