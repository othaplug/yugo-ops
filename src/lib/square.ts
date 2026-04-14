import { SquareClient, SquareEnvironment } from "square";

/**
 * Production by default so local `next dev` still talks to the same Square seller as production
 * (reconcile and webhooks otherwise hit Sandbox and invoices.get returns nothing useful).
 * Opt into Sandbox only when explicitly configured.
 */
function resolveSquareApiEnvironment(): (typeof SquareEnvironment)[keyof typeof SquareEnvironment] {
  const envOverride = (process.env.SQUARE_ENVIRONMENT || "").trim().toLowerCase();
  const forceSandbox =
    envOverride === "sandbox" ||
    (process.env.SQUARE_USE_SANDBOX || "").toLowerCase() === "true" ||
    (process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX || "").toLowerCase() === "true";
  if (forceSandbox) return SquareEnvironment.Sandbox;
  return SquareEnvironment.Production;
}

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN || "",
  environment: resolveSquareApiEnvironment(),
});
