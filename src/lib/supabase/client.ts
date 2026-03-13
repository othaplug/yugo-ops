import { createBrowserClient } from "@supabase/ssr";
import type { UserResponse } from "@supabase/supabase-js";

function isRefreshTokenError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "");
  const name = (err as { name?: string }).name ?? "";
  return (
    name === "AuthApiError" ||
    /refresh\s*token\s*not\s*found|invalid\s*refresh\s*token/i.test(msg)
  );
}

async function handleStaleSession(client: ReturnType<typeof createBrowserClient>): Promise<void> {
  await client.auth.signOut();
  if (typeof window !== "undefined") {
    const loginPath = window.location.pathname.startsWith("/partner")
      ? "/partner/login"
      : "/login";
    window.location.href = loginPath;
  }
}

export const createClient = () => {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const origGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (options): Promise<UserResponse> => {
    try {
      return await origGetUser(options);
    } catch (err) {
      if (isRefreshTokenError(err)) {
        await handleStaleSession(client);
        return { data: { user: null }, error: err } as UserResponse;
      }
      throw err;
    }
  };

  const origGetSession = client.auth.getSession.bind(client.auth);
  type SessionResponse = Awaited<ReturnType<typeof origGetSession>>;
  client.auth.getSession = async (): Promise<SessionResponse> => {
    try {
      return await origGetSession();
    } catch (err) {
      if (isRefreshTokenError(err)) {
        await handleStaleSession(client);
        return { data: { session: null }, error: err } as SessionResponse;
      }
      throw err;
    }
  };

  return client;
};