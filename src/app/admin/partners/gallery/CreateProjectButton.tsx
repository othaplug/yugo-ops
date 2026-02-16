"use client";

import { useState } from "react";
import CreateProjectModal from "./CreateProjectModal";

export default function CreateProjectButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
      >
        + Create Project
      </button>
      <CreateProjectModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
