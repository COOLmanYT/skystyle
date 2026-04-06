import { redirect } from "next/navigation";

/** /dev/dashboard has been moved to /dev. Redirect for backwards compatibility. */
export default function DevDashboardRedirectPage() {
  redirect("/dev");
}
