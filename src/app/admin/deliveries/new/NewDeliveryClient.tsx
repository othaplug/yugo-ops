"use client";

import BackButton from "../../components/BackButton";

export default function NewDeliveryClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mb-4">
        <BackButton label="Back" />
      </div>
      {children}
    </>
  );
}
