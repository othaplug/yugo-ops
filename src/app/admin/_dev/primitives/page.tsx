import { notFound } from "next/navigation"
import { PrimitivesHarness } from "./primitives-harness"

export const dynamic = "force-dynamic"

const DevPrimitivesPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }
  return <PrimitivesHarness />
}

export default DevPrimitivesPage
