import { notFound } from "next/navigation"

import { Yu3UiLabClient } from "./yu3-ui-lab-client"

export const dynamic = "force-dynamic"

const Yu3UiLabPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }
  return <Yu3UiLabClient />
}

export default Yu3UiLabPage
