"use client";

import * as React from "react";
import { PageHeader } from "@/design-system/admin/layout";
import { Button } from "@/design-system/admin/primitives";
import { KpiStrip } from "@/design-system/admin/dashboard";
import { ArrowClockwise, Plus } from "@phosphor-icons/react";
import InvoicesPageClient from "./InvoicesPageClient";

type Kpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export default function InvoicesV3Client({
  invoices,
  kpis,
  loadError,
  orgEmbedWarning,
}: {
  invoices: unknown[];
  kpis: Kpi[];
  loadError: string | null;
  orgEmbedWarning: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Finance"
        title="Invoices"
        description="All Square-backed invoices across moves and deliveries."
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<ArrowClockwise size={15} />}
              onClick={() => {
                window.location.reload();
              }}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Plus size={15} />}
              onClick={() => {
                window.location.href = "/admin/finance/invoices/new";
              }}
            >
              New invoice
            </Button>
          </>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="px-3 py-2 rounded-[var(--yu3-r-sm)] bg-[color-mix(in_oklab,var(--yu3-danger)_12%,transparent)] border border-[color-mix(in_oklab,var(--yu3-danger)_35%,transparent)] text-[var(--yu3-danger)] text-[12px]"
        >
          Unable to load invoices. {loadError}
        </div>
      ) : null}
      {orgEmbedWarning ? (
        <div
          role="status"
          className="px-3 py-2 rounded-[var(--yu3-r-sm)] bg-[color-mix(in_oklab,var(--yu3-warning)_12%,transparent)] border border-[color-mix(in_oklab,var(--yu3-warning)_35%,transparent)] text-[var(--yu3-warning)] text-[12px]"
        >
          {orgEmbedWarning}
        </div>
      ) : null}

      <KpiStrip tiles={kpis} columns={5} />

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <InvoicesPageClient invoices={invoices as any[]} />
    </div>
  );
}
