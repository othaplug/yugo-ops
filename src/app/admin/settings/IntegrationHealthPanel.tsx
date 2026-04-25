"use client";

import { useState } from "react";
import GlobalModal from "@/components/ui/Modal";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";

type IconName = "creditCard" | "mail" | "phone" | "mapPin" | "link" | "plug" | "messageSquare";

interface IntegrationConfig {
  key: string;
  label: string;
  desc: string;
  icon: IconName;
  connected: boolean;
  details?: string;
  category?: string;
}

const CATEGORY_ORDER = ["Payments", "Communications", "Mapping", "CRM", "Accounting", "Automation"];

/** How each integration is wired — set these in your deployment environment (hosting provider env vars). */
const SETUP_GUIDE: Record<string, { title: string; bullets: string[] }> = {
  square: {
    title: "Square",
    bullets: [
      "Set SQUARE_ACCESS_TOKEN (and optionally SQUARE_ENVIRONMENT: sandbox | production).",
      "Create API credentials in Square Developer Dashboard → Applications.",
      "After saving env vars, redeploy so the server picks them up.",
    ],
  },
  resend: {
    title: "Resend",
    bullets: [
      "Set RESEND_API_KEY in your deployment environment.",
      "Verify your sending domain in the Resend dashboard.",
    ],
  },
  openphone: {
    title: "OpenPhone",
    bullets: [
      "Set OPENPHONE_API_KEY and OPENPHONE_PHONE_NUMBER_ID.",
      "Used for SMS quotes, dispatch, and notification SMS when enabled.",
    ],
  },
  mapbox: {
    title: "Mapbox",
    bullets: [
      "Set MAPBOX_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN (public token is fine for geocoding + maps).",
      "Create a token at mapbox.com → Account → Access tokens.",
    ],
  },
  hubspot: {
    title: "HubSpot",
    bullets: [
      "Set HUBSPOT_ACCESS_TOKEN (private app token with CRM scope).",
      "Create under HubSpot → Settings → Integrations → Private Apps.",
    ],
  },
  quickbooks: {
    title: "QuickBooks",
    bullets: [
      "Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.",
      "Complete Intuit OAuth in a future release; credentials must be present for accounting sync.",
    ],
  },
  zapier: {
    title: "Zapier",
    bullets: [
      "Set ZAPIER_WEBHOOK_SECRET if you validate incoming Zapier hooks.",
      "Build Zaps that POST to your app’s webhooks (configure URLs in Automation).",
    ],
  },
  slack: {
    title: "Slack",
    bullets: [
      "Optional: SLACK_WEBHOOK_URL from Slack → Incoming Webhooks (used for Test Connection).",
      "Track alerts & channel history: SLACK_BOT_TOKEN and SLACK_ADMIN_CHANNEL or SLACK_CHANNEL_ID (channel ID). Invite the bot to that channel.",
      "Live updates: SLACK_SIGNING_SECRET + Event Subscriptions URL …/api/slack/events, subscribe to message.channels (and message.groups if private). Bot scopes: channels:history, channels:read, chat:write, users:read, bots:read; private channel also groups:history + groups:read. Reinstall app after scope changes and refresh SLACK_BOT_TOKEN.",
    ],
  },
};

export default function IntegrationHealthPanel({
  integrations,
}: {
  integrations: IntegrationConfig[];
}) {
  const { toast } = useToast();
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ms?: number; message?: string }>>({});
  const [setupKey, setSetupKey] = useState<string | null>(null);

  const handleTest = async (key: string) => {
    setTesting(key);
    try {
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ key }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        ms?: number;
      };
      const ok = !!data.ok;
      const ms = typeof data.ms === "number" ? data.ms : undefined;
      const message = typeof data.message === "string" ? data.message : ok ? "OK" : "Failed";
      setTestResults((prev) => ({ ...prev, [key]: { ok, ms, message } }));
      toast(ok ? `${key}: ${message}${ms != null ? ` (${ms}ms)` : ""}` : `${key}: ${message}`, ok ? "check" : "x");
    } catch {
      setTestResults((prev) => ({ ...prev, [key]: { ok: false, message: "Request failed" } }));
      toast("Connection test failed", "x");
    } finally {
      setTesting(null);
    }
  };

  const openSetup = (key: string) => {
    setSetupKey(key);
  };

  // Group by category
  const grouped: Record<string, IntegrationConfig[]> = {};
  for (const item of integrations) {
    const cat = item.category ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const categories = CATEGORY_ORDER.filter((c) => grouped[c]);

  const setup = setupKey ? SETUP_GUIDE[setupKey] : null;

  const IntegrationCard = ({ item }: { item: IntegrationConfig }) => {
    const result = testResults[item.key];
    return (
      <div className="border border-[var(--brd)] rounded-lg overflow-hidden">
        <div className="flex items-start justify-between px-4 py-3.5 gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.connected ? "bg-[var(--grn)]/10" : "bg-[var(--bg)]"}`}>
              <Icon name={item.icon} className={`w-[16px] h-[16px] ${item.connected ? "text-[var(--grn)]" : "text-[var(--tx3)]"}`} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5 leading-snug">{item.desc}</div>
              {item.details && (
                <div className="text-[10px] text-[var(--tx3)] mt-1 font-mono">{item.details}</div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className={`text-[10px] font-semibold flex items-center gap-1.5 dt-badge tracking-[0.04em] ${
              item.connected
                ? "text-[var(--grn)]"
                : "text-[var(--tx3)]"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${item.connected ? "bg-[var(--grn)]" : "bg-[var(--tx3)]/40"}`} />
              {item.connected ? "Connected" : "Not connected"}
            </div>
            {result && (
              <div className={`text-[9px] font-mono max-w-[140px] text-right ${result.ok ? "text-[var(--grn)]" : "text-[var(--red)]"}`}>
                {result.ok ? `OK${result.ms != null ? ` (${result.ms}ms)` : ""}` : result.message || "Failed"}
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-2.5 border-t border-[var(--brd)] bg-[var(--bg)] flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openSetup(item.key)}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--accent-text)] transition-all"
          >
            Configure
          </button>
          {item.connected ? (
            <button
              type="button"
              onClick={() => handleTest(item.key)}
              disabled={testing === item.key}
              className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-[var(--gold)] text-[var(--accent-text)] hover:bg-[var(--gold)]/10 transition-all disabled:opacity-50"
            >
              {testing === item.key ? "Testing…" : "Test Connection"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openSetup(item.key)}
              className="admin-btn admin-btn-sm admin-btn-primary"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    );
  };

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="space-y-5">
      <GlobalModal open={!!setup} onClose={() => setSetupKey(null)} title={setup?.title ?? ""} maxWidth="md">
        {setup && (
          <>
            <ul className="text-[12px] text-[var(--tx2)] space-y-2 list-disc pl-4 mb-4">
              {setup.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <p className="text-[11px] text-[var(--tx3)] mb-4">
              Add variables in your hosting or deployment settings (environment variables), then redeploy.
            </p>
            <button
              type="button"
              onClick={() => setSetupKey(null)}
              className="admin-btn admin-btn-primary w-full"
            >
              Done
            </button>
          </>
        )}
      </GlobalModal>

      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-[var(--tx)]">
            {connectedCount} of {integrations.length} services connected
          </div>
          <div className="mt-1.5 h-1.5 bg-[var(--brd)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--grn)] rounded-full transition-all"
              style={{ width: `${(connectedCount / integrations.length) * 100}%` }}
            />
          </div>
        </div>
        <span className={`text-[11px] font-bold dt-badge tracking-[0.04em] ${connectedCount === integrations.length ? "text-[var(--grn)]" : "text-[var(--org)]"}`}>
          {connectedCount === integrations.length ? "All Systems Go" : "Action Needed"}
        </span>
      </div>

      {/* Grouped cards */}
      {categories.map((cat) => (
        <div key={cat}>
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">{cat}</div>
          <div className="space-y-2">
            {grouped[cat].map((item) => (
              <IntegrationCard key={item.key} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
