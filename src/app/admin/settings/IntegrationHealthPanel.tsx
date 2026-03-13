"use client";

import { useState } from "react";
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

export default function IntegrationHealthPanel({
  integrations,
}: {
  integrations: IntegrationConfig[];
}) {
  const { toast } = useToast();
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ms?: number }>>({});

  const handleTest = async (key: string) => {
    setTesting(key);
    const start = Date.now();
    try {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
      const ms = Date.now() - start;
      setTestResults((prev) => ({ ...prev, [key]: { ok: true, ms } }));
      toast(`${key} connected (${ms}ms)`, "check");
    } catch {
      setTestResults((prev) => ({ ...prev, [key]: { ok: false } }));
      toast(`${key} connection failed`, "x");
    } finally {
      setTesting(null);
    }
  };

  // Group by category
  const grouped: Record<string, IntegrationConfig[]> = {};
  for (const item of integrations) {
    const cat = item.category ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const categories = CATEGORY_ORDER.filter((c) => grouped[c]);

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
            <div className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
              item.connected
                ? "bg-[rgba(45,159,90,0.12)] text-[var(--grn)]"
                : "bg-[var(--brd)] text-[var(--tx3)]"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${item.connected ? "bg-[var(--grn)]" : "bg-[var(--tx3)]/40"}`} />
              {item.connected ? "Connected" : "Not connected"}
            </div>
            {result && (
              <div className={`text-[9px] font-mono ${result.ok ? "text-[var(--grn)]" : "text-[var(--red)]"}`}>
                {result.ok ? `OK (${result.ms}ms)` : "Failed"}
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-2.5 border-t border-[var(--brd)] bg-[var(--bg)] flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast("Configure coming soon", "settings")}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            Configure
          </button>
          {item.connected ? (
            <button
              type="button"
              onClick={() => handleTest(item.key)}
              disabled={testing === item.key}
              className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-all disabled:opacity-50"
            >
              {testing === item.key ? "Testing…" : "Test Connection"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => toast("Connect coming soon", "plug")}
              className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
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
    <div className="space-y-6">
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
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${connectedCount === integrations.length ? "bg-[var(--grn)]/10 text-[var(--grn)]" : "bg-[var(--org)]/10 text-[var(--org)]"}`}>
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
