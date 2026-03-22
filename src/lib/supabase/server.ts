import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { UserResponse } from "@supabase/supabase-js";

function isRefreshTokenError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "");
  return /refresh\s*token/i.test(msg);
}

export const createClient = async () => {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can't always set cookies
          }
        },
      },
    }
  );

  const origGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (options): Promise<UserResponse> => {
    try {
      const result = await origGetUser(options);
      if (result.error && isRefreshTokenError(result.error)) {
        await client.auth.signOut();
        return { data: { user: null }, error: result.error } as UserResponse;
      }
      return result;
    } catch (err) {
      if (isRefreshTokenError(err)) {
        await client.auth.signOut();
        return { data: { user: null }, error: err } as UserResponse;
      }
      throw err;
    }
  };

  return client;
};