"use client"

import PartnerOnboardingWizard from "@/app/admin/platform/PartnerOnboardingWizard"
import { useRouter } from "next/navigation"

export default function PartnerOnboardingPageClient() {
  const router = useRouter()
  const handleDismiss = () => {
    router.push("/admin/partners")
    router.refresh()
  }

  return (
    <div className="flex w-full min-w-0 flex-col py-4 md:py-6">
      <PartnerOnboardingWizard variant="page" onClose={handleDismiss} />
    </div>
  )
}
