"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/design-system/admin/layout";
import { Button } from "@/design-system/admin/primitives";
import CreateMoveForm from "../new/CreateMoveForm";
import { PMBatchClient } from "../pm-batch/PMBatchClient";
import FromQuoteMovePanel from "./FromQuoteMovePanel";

export type CreateMoveWorkflowMode = "single" | "pm_batch" | "from_quote";

type OrgRow = Parameters<typeof CreateMoveForm>[0]["organizations"][number];
type CrewRow = Parameters<typeof CreateMoveForm>[0]["crews"][number];
type ItemWeightRow = NonNullable<
  Parameters<typeof CreateMoveForm>[0]["itemWeights"]
>[number];

function normalizeMode(raw: string | null): CreateMoveWorkflowMode {
  if (raw === "pm_batch" || raw === "from_quote") return raw;
  return "single";
}

export default function CreateMovePageClient({
  organizations,
  crews,
  itemWeights = [],
}: {
  organizations: OrgRow[];
  crews: CrewRow[];
  itemWeights?: ItemWeightRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setModeState] = React.useState<CreateMoveWorkflowMode>(() =>
    normalizeMode(searchParams.get("mode")),
  );

  React.useEffect(() => {
    setModeState(normalizeMode(searchParams.get("mode")));
  }, [searchParams]);

  const subtitle = React.useMemo(() => {
    if (mode === "pm_batch") {
      return "Schedule multiple property management moves against a partner contract and buildings."
    }
    if (mode === "from_quote") {
      return "Link an accepted quote that does not yet have a move."
    }
    return "Configure service, contacts, scheduling, inventory, then create the booking."
  }, [mode]);

  const syncUrl = React.useCallback(
    (next: CreateMoveWorkflowMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "single") {
        params.delete("mode")
      } else {
        params.set("mode", next)
      }

      const s = params.toString();
      router.replace(s ? `/admin/moves/create?${s}` : "/admin/moves/create", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const handleChangeMode = (next: CreateMoveWorkflowMode) => {
    setModeState(next);
    syncUrl(next)
  };

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        eyebrow="Operations"
        title="Create move"
        description={subtitle}
        className="pb-2"
      />

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Create move workflow"
      >
        <Button
          type="button"
          variant={mode === "single" ? "primary" : "secondary"}
          size="sm"
          uppercase
          aria-pressed={mode === "single"}
          onClick={() => handleChangeMode("single")}
        >
          Single move
        </Button>
        <Button
          type="button"
          variant={mode === "pm_batch" ? "primary" : "secondary"}
          size="sm"
          uppercase
          aria-pressed={mode === "pm_batch"}
          onClick={() => handleChangeMode("pm_batch")}
        >
          PM batch
        </Button>
        <Button
          type="button"
          variant={mode === "from_quote" ? "primary" : "secondary"}
          size="sm"
          uppercase
          aria-pressed={mode === "from_quote"}
          onClick={() => handleChangeMode("from_quote")}
        >
          From quote
        </Button>
      </div>

      {mode === "single" ? (
        <CreateMoveForm
          organizations={organizations}
          crews={crews}
          itemWeights={itemWeights}
          initialQuoteUuid={searchParams.get("quote_uuid")}
        />
      ) : null}

      {mode === "pm_batch" ? <PMBatchClient embedded /> : null}

      {mode === "from_quote" ? <FromQuoteMovePanel /> : null}
    </div>
  )
}
