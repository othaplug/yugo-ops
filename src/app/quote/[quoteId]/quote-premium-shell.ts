import { ESTATE_ON_WINE } from "./estate-quote-ui";
import { SIGNATURE_ON_SHELL } from "./signature-quote-ui";

export type PremiumShellKind = "none" | "wine" | "signature";

export type PremiumSurfaceInk =
  | (typeof ESTATE_ON_WINE)
  | (typeof SIGNATURE_ON_SHELL);

export function premiumShellKind(
  isResidential: boolean,
  tier: string | null | undefined,
): PremiumShellKind {
  if (!isResidential || !tier) return "none";
  const t = tier.toLowerCase();
  if (t === "estate") return "wine";
  if (t === "signature") return "signature";
  return "none";
}

export function premiumShellInk(
  kind: PremiumShellKind,
): PremiumSurfaceInk | null {
  if (kind === "wine") return ESTATE_ON_WINE;
  if (kind === "signature") return SIGNATURE_ON_SHELL;
  return null;
}

/** Section border-t under premium shells */
export function premiumShellSectionBorderClass(kind: PremiumShellKind): string {
  if (kind === "wine") return "border-[#66143D]/30";
  if (kind === "signature") return "border-[#4A6B52]/35";
  return "border-[#2C3E2D]/15";
}

/** Horizontal rules / hairlines that used rose-tinted rgba on wine */
export function premiumShellRuleRgba(kind: PremiumShellKind): string {
  if (kind === "wine") return "rgba(102, 20, 61, 0.35)";
  if (kind === "signature") return "rgba(74, 107, 82, 0.45)";
  return `rgba(44, 62, 45, 0.18)`;
}
