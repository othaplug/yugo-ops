"use client";

import DeliveryDayForm from "@/components/delivery-day/DeliveryDayForm";

interface Props {
  orgId: string;
  orgType: string;
  onClose: () => void;
  onCreated: () => void;
  initialDate?: string;
}

export default function PartnerScheduleModal({ orgId, orgType, onClose, onCreated, initialDate = "" }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-0 sm:p-4 modal-overlay"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[640px] max-h-[92vh] overflow-y-auto mx-0 sm:mx-4 flex flex-col sheet-card sm:modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E8E4DF] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 z-10">
          <h2 className="font-hero text-[26px] sm:text-[30px] font-bold text-[#1A1A1A]">
            Schedule Delivery
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors text-[#666]"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4">
          <DeliveryDayForm
            mode="partner"
            orgId={orgId}
            orgType={orgType}
            initialDate={initialDate}
            onSuccess={onCreated}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
