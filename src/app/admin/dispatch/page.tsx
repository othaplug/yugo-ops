import { redirect } from "next/navigation"

/**
 * Dispatch is folded into the main overview. The board is still available if we
 * add a deep link or tab on /admin in the future.
 */
export default function DispatchRedirectPage() {
  redirect("/admin")
}
