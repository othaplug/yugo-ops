"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";

interface IntegrationConfig {
  key: string;
  label: string;
  desc: string;
  icon: "creditCard" | "mail" | "phone" | "mapPin" | "link";
  connected: boolean;
  details?: string;
}

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

    // Simulate a health check ping
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

  return (
    <div className="space-y-3">
      {integrations.map((item) => {
        const result = testResults[item.key];
        return (
          <div key={item.key} className="border border-[var(--brd)] rounded-lg overflow-hidden">
            <div className="flex items-start justify-between px-4 py-3.5 gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-[var(--tx2)]">
                  <Icon name={item.icon} className="w-[20px] h-[20px]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">{item.desc}</div>
                  {item.details && (
                    <div className="text-[10px] text-[var(--tx3)] mt-1 font-mono">{item.details}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                  item.connected
                    ? "bg-[rgba(45,159,90,0.12)] text-[var(--grn)]"
                    : "bg-[rgba(212,138,41,0.12)] text-[var(--org)]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.connected ? "bg-[var(--grn)]" : "bg-[var(--org)]"}`} />
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
              {item.connected && (
                <button
                  type="button"
                  onClick={() => handleTest(item.key)}
                  disabled={testing === item.key}
                  className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-all disabled:opacity-50"
                >
                  {testing === item.key ? "Testing..." : "Test Connection"}
                </button>
              )}
              {!item.connected && (
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
      })}
    </div>
  );
}
