"use client";

import { useState } from "react";
import Link from "next/link";

export default function PlatformSettingsClient() {
  const [crewTracking, setCrewTracking] = useState(true);
  const [partnerPortal, setPartnerPortal] = useState(false);
  const [autoInvoicing, setAutoInvoicing] = useState(true);

  return (
    <div className="space-y-6">
      {/* Pricing & Rates */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <span>💰</span> Pricing & Rates
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Configure delivery rates and pricing tiers</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Base Delivery Rate ($)</label>
            <input
              type="number"
              defaultValue="150"
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Hourly Rate ($)</label>
            <input
              type="number"
              defaultValue="85"
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors"
            />
          </div>
          <button className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all">
            Save Rates
          </button>
        </div>
      </div>

      {/* Crews & Teams */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <span>👥</span> Crews & Teams
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Manage crew tracking and team assignments</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          {[
            { label: "Crew GPS Tracking", desc: "Enable real-time crew location tracking", state: crewTracking, set: setCrewTracking },
            { label: "Partner Portal Access", desc: "Allow partners to view their deliveries", state: partnerPortal, set: setPartnerPortal },
            { label: "Auto-Invoicing", desc: "Generate invoices automatically on delivery", state: autoInvoicing, set: setAutoInvoicing },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
              <div>
                <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
                <div className="text-[11px] text-[var(--tx3)] mt-0.5">{item.desc}</div>
              </div>
              <button
                onClick={() => item.set(!item.state)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  item.state ? "bg-[var(--gold)]" : "bg-[var(--brd)]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    item.state ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Partners Management */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <span>🤝</span> Partners Management
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Retail, designers, hospitality, galleries</p>
        </div>
        <div className="px-5 py-5 space-y-2">
          {[
            { label: "Retail", slug: "retail" },
            { label: "Designers", slug: "designers" },
            { label: "Hospitality", slug: "hospitality" },
            { label: "Galleries", slug: "gallery" },
            { label: "Realtors", slug: "realtors" },
          ].map(({ label, slug }) => (
            <div key={slug} className="flex items-center justify-between py-2.5 border-b border-[var(--brd)] last:border-0">
              <div className="text-[13px] font-medium text-[var(--tx)]">{label}</div>
              <Link href={`/admin/partners/${slug}`} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
                Manage →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* User Management */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <span>🔐</span> User Management
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Roles, permissions, and access control</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-[var(--brd)]">
            <div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">Administrator</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">Full access to all features</div>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--gdim)] text-[var(--gold)]">Admin</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">Dispatcher</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">Manage deliveries and crew</div>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--bldim)] text-[var(--blue)]">Dispatcher</span>
          </div>
          <button className="mt-2 px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">
            + Invite User
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[var(--card)] border border-[var(--red)]/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--red)]/10 bg-[rgba(209,67,67,0.04)]">
          <h2 className="text-[16px] font-bold text-[var(--red)] flex items-center gap-2">
            <span>⚠️</span> Danger Zone
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Irreversible platform actions</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-[var(--brd)]">
            <div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">Reset All Settings</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">Restore platform defaults</div>
            </div>
            <button className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--org)]/40 text-[var(--org)] hover:bg-[var(--ordim)] transition-all">
              Reset
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-[13px] font-semibold text-[var(--red)]">Delete Platform Data</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">Permanently delete all platform data</div>
            </div>
            <button className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--red)]/40 text-[var(--red)] hover:bg-[var(--rdim)] transition-all">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
